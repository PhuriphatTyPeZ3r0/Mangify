const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// --- Config & Auth ---
const envPath = path.join(__dirname, "../.env.local");
let envVars = process.env; // Default to process.env for CI

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        envVars[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    }
  });
}

const cleanEnvVar = (val) => {
  if (!val) return "";
  return val.replace(/^['"]|['"]$/g, "").trim();
};

let supabaseUrl = cleanEnvVar(envVars["NEXT_PUBLIC_SUPABASE_URL"]);
const serviceRoleKey = cleanEnvVar(envVars["SUPABASE_SERVICE_ROLE_KEY"]);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

// Auto-prepend https:// if protocol is missing
if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  console.log(`ℹ️ Info: NEXT_PUBLIC_SUPABASE_URL does not start with http/https. Auto-prepending https://`);
  supabaseUrl = "https://" + supabaseUrl;
}

// Safe diagnostic log to verify URL format without leaking sensitive project IDs
const safeUrlPrefix = supabaseUrl.substring(0, 12);
console.log(`🔍 Diagnostic: Parsed NEXT_PUBLIC_SUPABASE_URL length = ${supabaseUrl.length}, prefix = "${safeUrlPrefix}..."`);

if (supabaseUrl.includes("placeholder") || supabaseUrl.includes("your-supabase")) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL is configured with a placeholder value. Please check your .env.local or GitHub secrets.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Static mapping table for Supabase ID -> up-manga.com URL slug
const slugMap = {
  // Empty for now as no ID-to-slug discrepancies exist
};

const getSlugFromId = (id) => {
  return slugMap[id] || id;
};

// Popularity score calculation helper functions
const parseViews = (viewsStr) => {
  if (!viewsStr) return 0;
  const cleanStr = viewsStr.trim().toLowerCase();
  if (cleanStr.includes('m')) {
    return parseFloat(cleanStr.replace('m', '')) * 1000000;
  }
  if (cleanStr.includes('k')) {
    return parseFloat(cleanStr.replace('k', '')) * 1000;
  }
  return parseInt(cleanStr.replace(/\D/g, ""), 10) || 0;
};

const parseFollowers = (followersStr) => {
  if (!followersStr) return 0;
  return parseInt(followersStr.replace(/\D/g, ""), 10) || 0;
};

async function backfill() {
  console.log("🚀 Starting metadata backfill...");
  
  // 1. Fetch all mangas from Supabase
  const { data: mangas, error } = await supabaseAdmin.from("manga").select("id, title");
  if (error) {
    console.error("❌ Failed to fetch mangas from Supabase:", error.message);
    process.exit(1);
  }

  console.log(`📂 Found ${mangas.length} mangas in database.`);
  if (mangas.length === 0) {
    console.log("🏁 No mangas to backfill.");
    return;
  }

  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, yyyy) Chrome/120.0.0.0 Safari/537.36");

  let successCount = 0;
  let failCount = 0;

  for (const manga of mangas) {
    const slug = getSlugFromId(manga.id);
    const mangaUrl = `https://www.up-manga.com/${slug}/`;
    console.log(`\n📖 [${manga.title}] -> Fetching metadata from: ${mangaUrl}`);

    try {
      await page.goto(mangaUrl, { waitUntil: "networkidle2" });
      await new Promise(r => setTimeout(r, 1500)); // Throttling delay

      const mangaData = await page.evaluate(() => {
        // Extract from Info Table
        const infoRows = Array.from(document.querySelectorAll('.infotable tr'));
        let status = "Ongoing";
        let type = "Manhwa";
        let releaseYear = null;
        let author = "";
        let artist = "";
        let viewsCount = "0";

        infoRows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length === 2) {
            const label = cells[0].textContent.trim();
            const value = cells[1].textContent.trim();

            if (label.includes("สถานะ")) {
              status = value;
            } else if (label.includes("ประเภท")) {
              type = value;
            } else if (label.includes("ปีที่ปล่อย")) {
              const yearNum = parseInt(value, 10);
              if (!isNaN(yearNum)) releaseYear = yearNum;
            } else if (label.includes("ผู้แต่ง")) {
              author = value;
            } else if (label.includes("ผู้เขียน")) {
              artist = value;
            } else if (label.includes("Views")) {
              viewsCount = value;
            }
          }
        });

        // Fallback for author if not found in table
        if (!author) {
          author = document.querySelector('.spe span:nth-child(2)')?.textContent?.replace('Author:', '').trim() || "";
        }

        // Extract Alternative Title
        const originalTitle = document.querySelector('.seriestualt')?.textContent?.trim() || "";

        // Extract Followers Count
        const followersText = document.querySelector('.bmc')?.textContent || "";

        // Extract Genres
        const genres = Array.from(document.querySelectorAll('.seriestugenre a'))
          .map(a => a.textContent.trim())
          .filter(Boolean);

        return { author, artist, status, type, releaseYear, viewsCount, originalTitle, genres, followersText };
      });

      const rawViews = parseViews(mangaData.viewsCount);
      const rawFollowers = parseFollowers(mangaData.followersText);
      const popularityScore = Math.round((rawViews * 0.7) + (rawFollowers * 0.3));

      console.log(`   └─ 📈 Calculated Popularity: ${popularityScore} (Views: ${rawViews}, Followers: ${rawFollowers})`);
      console.log(`   └─ 🏷️ Genres: [${mangaData.genres.join(", ")}]`);
      console.log(`   └─ 🎨 Artist: ${mangaData.artist || 'N/A'}, Alternative Title: ${mangaData.originalTitle || 'N/A'}`);

      const { error: updateError } = await supabaseAdmin
        .from("manga")
        .update({
          author: mangaData.author || null,
          artist: mangaData.artist || null,
          genres: mangaData.genres || [],
          original_title: mangaData.originalTitle || null,
          status: mangaData.status || 'Ongoing',
          manga_type: mangaData.type || 'Manhwa',
          release_year: mangaData.releaseYear || null,
          views_count: mangaData.viewsCount || '0',
          popularity: popularityScore
        })
        .eq("id", manga.id);

      if (updateError) {
        console.error(`   ❌ Update error: ${updateError.message}`);
        failCount++;
      } else {
        console.log(`   ✅ Success!`);
        successCount++;
      }

    } catch (err) {
      console.error(`   ❌ Failed to scrape metadata for '${manga.title}':`, err.message);
      failCount++;
    }
  }

  await browser.close();
  console.log(`\n🏁 Backfill finished! Success: ${successCount}, Failed: ${failCount}`);
}

backfill();
