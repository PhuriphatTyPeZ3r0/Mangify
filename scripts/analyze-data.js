const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local file not found");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      envVars[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }
});

const cleanEnvVar = (val) => {
  if (!val) return "";
  return val.replace(/^['"]|['"]$/g, "").trim();
};

const supabaseUrl = cleanEnvVar(envVars["NEXT_PUBLIC_SUPABASE_URL"]);
const serviceRoleKey = cleanEnvVar(envVars["SUPABASE_SERVICE_ROLE_KEY"]);
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Extracts a floating point number or integer from a string
function extractNumber(str) {
  if (!str) return null;
  // Match decimals or integers (e.g. 12, 12.5, 58-5)
  const match = str.match(/(\d+[\.\-]?\d*)/);
  if (match) {
    let val = match[1].replace("-", ".");
    return parseFloat(val);
  }
  return null;
}

async function analyze() {
  console.log("=== Database Analysis Starting ===");
  
  // 1. Fetch all mangas
  const { data: mangas, error: mErr } = await supabase.from("manga").select("id, title");
  if (mErr) throw mErr;
  console.log(`Loaded ${mangas.length} mangas.`);

  // 2. Fetch all chapters
  let chapters = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("chapters")
      .select("id, manga_id, title, pages")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    chapters = [...chapters, ...data];
    offset += limit;
  }
  console.log(`Loaded ${chapters.length} chapters.`);

  const mangaChapterMap = {};
  mangas.forEach(m => {
    mangaChapterMap[m.id] = {
      title: m.title,
      chapters: []
    };
  });

  const duplicates = [];
  const mismatches = [];
  
  chapters.forEach(ch => {
    if (!mangaChapterMap[ch.manga_id]) {
      mangaChapterMap[ch.manga_id] = { title: "Unknown", chapters: [] };
    }
    mangaChapterMap[ch.manga_id].chapters.push(ch);
  });

  // Analyze each manga
  const missingChaptersReport = [];

  for (const mangaId in mangaChapterMap) {
    const mInfo = mangaChapterMap[mangaId];
    const chs = mInfo.chapters;
    
    // Check duplicates by title
    const seenTitles = {};
    chs.forEach(ch => {
      if (seenTitles[ch.title]) {
        duplicates.push({
          manga: mInfo.title,
          mangaId,
          title: ch.title,
          ids: [seenTitles[ch.title].id, ch.id]
        });
      } else {
        seenTitles[ch.title] = ch;
      }
    });

    // Check title-ID mismatches
    const parsedChapters = [];
    chs.forEach(ch => {
      const decodedId = decodeURIComponent(ch.id);
      
      // Extract chapter number from ID suffix (e.g. -48, -58.5, -ep-12)
      const idNum = extractNumber(decodedId.substring(decodedId.lastIndexOf("-")));
      const titleNum = extractNumber(ch.title);

      if (idNum !== null && titleNum !== null && idNum !== titleNum) {
        mismatches.push({
          manga: mInfo.title,
          mangaId,
          chapterId: ch.id,
          decodedId,
          title: ch.title,
          idNum,
          titleNum
        });
      }

      if (titleNum !== null) {
        parsedChapters.push({ num: titleNum, ch });
      }
    });

    // Sort chapters by parsed number to find gaps
    parsedChapters.sort((a, b) => a.num - b.num);
    const gaps = [];
    for (let i = 0; i < parsedChapters.length - 1; i++) {
      const current = parsedChapters[i].num;
      const next = parsedChapters[i+1].num;
      if (next - current > 1 && next - current <= 5) { // report small gaps, larger might be end of season
        for (let g = Math.floor(current) + 1; g < Math.floor(next); g++) {
          gaps.push(g);
        }
      }
    }
    
    if (gaps.length > 0) {
      missingChaptersReport.push({
        manga: mInfo.title,
        mangaId,
        gaps,
        existingCount: chs.length
      });
    }
  }

  console.log("\n=== Duplicate Chapters (Same Title) ===");
  console.log(`Found ${duplicates.length} duplicate chapter titles.`);
  console.log(JSON.stringify(duplicates.slice(0, 10), null, 2));

  console.log("\n=== Mismatched Chapter Numbers (Title vs ID) ===");
  console.log(`Found ${mismatches.length} mismatches.`);
  console.log(JSON.stringify(mismatches.slice(0, 10), null, 2));

  console.log("\n=== Missing Chapters (Numbering Gaps) ===");
  console.log(`Found ${missingChaptersReport.length} mangas with missing chapter gaps.`);
  console.log(JSON.stringify(missingChaptersReport.slice(0, 10), null, 2));
}

analyze().catch(console.error);
