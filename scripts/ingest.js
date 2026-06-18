const fs = require("fs");
const path = require("path");
const decompress = require("decompress");
const sharp = require("sharp");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// 1. Validate environment variables
const requiredEnv = [
  "MANGA_ID",
  "CHAPTER_ID",
  "CHAPTER_TITLE",
  "ZIP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_REPOSITORY" // Automatically provided by GitHub Actions (e.g. 'PhuriphatTyPeZ3r0/Mangify')
];

const missingEnv = requiredEnv.filter(env => !process.env[env]);
if (missingEnv.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnv.join(", "));
  process.exit(1);
}

const cleanEnvVar = (val) => {
  if (!val) return "";
  return val.replace(/^['"]|['"]$/g, "").trim();
};

function getStandardizedChapterId(mangaId, chapterUrlOrSegment, title) {
  const decoded = decodeURIComponent(chapterUrlOrSegment);
  
  // Extract the last path segment if it's a full URL
  let segment = decoded;
  if (segment.includes("/")) {
    segment = segment.split('/').filter(Boolean).pop();
  }
  
  let numStr = null;

  const patterns = [
    /[-_]ep[-_](\d+[\.\-]?\d*)/i,
    /[-_]ch[-_](\d+[\.\-]?\d*)/i,
    /[-_]ตอนที่[-_](\d+[\.\-]?\d*)/i,
    /[-_]ch(\d+)/i,
    /[-_](\d+[\.\-]?\d*)$/
  ];

  for (const pat of patterns) {
    const match = segment.match(pat);
    if (match) {
      numStr = match[1].replace("-", ".");
      break;
    }
  }

  if (!numStr && title) {
    const titleMatch = title.match(/(\d+[\.\-]?\d*)/);
    if (titleMatch) {
      numStr = titleMatch[1].replace("-", ".");
    }
  }

  if (!numStr) {
    // strip out the mangaId if it is present at the start of segment to avoid redundancy
    let suffix = segment;
    if (suffix.startsWith(mangaId)) {
      suffix = suffix.substring(mangaId.length);
    }
    suffix = suffix.replace(/^[-_]+/, "");
    return `${mangaId}-ch-${suffix.toLowerCase()}`;
  }

  return `${mangaId}-ch-${numStr}`;
}

const MANGA_ID = decodeURIComponent(cleanEnvVar(process.env.MANGA_ID));
const RAW_CHAPTER_ID = decodeURIComponent(cleanEnvVar(process.env.CHAPTER_ID));
const CHAPTER_TITLE = cleanEnvVar(process.env.CHAPTER_TITLE);
const CHAPTER_ID = getStandardizedChapterId(MANGA_ID, RAW_CHAPTER_ID, CHAPTER_TITLE);
const {
  ZIP_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GITHUB_REPOSITORY
} = process.env;

let NEXT_PUBLIC_SUPABASE_URL_CLEAN = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY_CLEAN = cleanEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!NEXT_PUBLIC_SUPABASE_URL_CLEAN) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL is missing.");
  process.exit(1);
}

// Auto-prepend https:// if protocol is missing
if (!NEXT_PUBLIC_SUPABASE_URL_CLEAN.startsWith("http://") && !NEXT_PUBLIC_SUPABASE_URL_CLEAN.startsWith("https://")) {
  console.log(`ℹ️ Info: NEXT_PUBLIC_SUPABASE_URL does not start with http/https. Auto-prepending https://`);
  NEXT_PUBLIC_SUPABASE_URL_CLEAN = "https://" + NEXT_PUBLIC_SUPABASE_URL_CLEAN;
}

// Safe diagnostic log to verify URL format without leaking sensitive project IDs
const safeUrlPrefix = NEXT_PUBLIC_SUPABASE_URL_CLEAN.substring(0, 12);
console.log(`🔍 Diagnostic: Parsed NEXT_PUBLIC_SUPABASE_URL length = ${NEXT_PUBLIC_SUPABASE_URL_CLEAN.length}, prefix = "${safeUrlPrefix}..."`);

if (NEXT_PUBLIC_SUPABASE_URL_CLEAN.includes("placeholder") || NEXT_PUBLIC_SUPABASE_URL_CLEAN.includes("your-supabase")) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL is configured with a placeholder value. Please check your GitHub secrets.");
  process.exit(1);
}

if (!NEXT_PUBLIC_SUPABASE_URL_CLEAN.startsWith("http://") && !NEXT_PUBLIC_SUPABASE_URL_CLEAN.startsWith("https://")) {
  console.error(`❌ Error: NEXT_PUBLIC_SUPABASE_URL ("${NEXT_PUBLIC_SUPABASE_URL_CLEAN}") must be a valid HTTP or HTTPS URL. Please verify your secrets.`);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL_CLEAN, SUPABASE_SERVICE_ROLE_KEY_CLEAN, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  // Save files to parent directory (outside of git workspace)
  const outputRoot = path.join(__dirname, "..", "..", "manga-output");
  const tempZipPath = path.join(outputRoot, "temp-download.zip");
  const extractedDir = path.join(outputRoot, "extracted-manga");
  const mangaOutputDir = path.join(outputRoot, "manga", MANGA_ID, CHAPTER_ID);

  try {
    console.log(`🚀 Starting ingestion for Manga: ${MANGA_ID}, Chapter: ${CHAPTER_ID} (${CHAPTER_TITLE})`);
    console.log(`📦 Downloading raw ZIP from URL: ${ZIP_URL}...`);

    // Ensure output directories exist
    fs.mkdirSync(outputRoot, { recursive: true });
    fs.mkdirSync(mangaOutputDir, { recursive: true });

    // 1. Download ZIP file
    const response = await axios({
      method: "get",
      url: ZIP_URL,
      responseType: "stream"
    });

    const writeStream = fs.createWriteStream(tempZipPath);
    await new Promise((resolve, reject) => {
      response.data.pipe(writeStream);
      response.data.on("error", reject);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    console.log("✅ ZIP downloaded successfully. Decompressing...");

    // 2. Extract ZIP
    if (fs.existsSync(extractedDir)) {
      fs.rmSync(extractedDir, { recursive: true, force: true });
    }
    await decompress(tempZipPath, extractedDir);
    console.log("✅ Decompression complete.");

    // 3. Scan extracted folder recursively for image files
    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
    
    function getAllFiles(dir, filesList = []) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
          getAllFiles(name, filesList);
        } else {
          const ext = path.extname(name).toLowerCase();
          if (imageExtensions.includes(ext) && !file.startsWith(".")) {
            filesList.push(name);
          }
        }
      }
      return filesList;
    }

    const allImages = getAllFiles(extractedDir);
    if (allImages.length === 0) {
      throw new Error("No image files found in the uploaded ZIP archive.");
    }

    // 4. Natural sorting (alphanumeric) to keep correct page order
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    allImages.sort((a, b) => collator.compare(path.basename(a), path.basename(b)));

    console.log(`📸 Found ${allImages.length} images. Processing and converting to WebP...`);

    const pageUrls = [];

    // 5. Convert to WebP and save to local directory
    for (let i = 0; i < allImages.length; i++) {
      const imgPath = allImages[i];
      const pageNumber = i + 1;
      const filename = `page-${pageNumber}.webp`;
      const outputFilePath = path.join(mangaOutputDir, filename);

      console.log(`⏳ Processing page ${pageNumber}/${allImages.length}: ${path.basename(imgPath)}`);

      // Optimize and convert via sharp
      await sharp(imgPath)
        .webp({ quality: 80 })
        .toFile(outputFilePath);

      // Construct the jsDelivr CDN URL
      const cdnUrl = `https://cdn.jsdelivr.net/gh/${GITHUB_REPOSITORY}@manga-assets/manga/${MANGA_ID}/${CHAPTER_ID}/${filename}`;
      pageUrls.push(cdnUrl);
    }

    console.log("✅ All pages optimized and saved locally for commit.");

    // 6. Database writes (Supabase)
    console.log("💾 Writing chapter data to Supabase database...");

    // Clean title and extract date
    let cleanTitle = CHAPTER_TITLE;
    let releaseDate = null;
    const dateRegex = /(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+\d+,\s+\d+/i;
    const dateMatch = CHAPTER_TITLE.match(dateRegex);
    if (dateMatch) {
      cleanTitle = CHAPTER_TITLE.replace(dateMatch[0], "").trim();
      releaseDate = dateMatch[0];
    }

    // 6.1 Ensure Manga record exists to satisfy foreign key constraints
    const { data: existingManga, error: mangaFetchError } = await supabase
      .from("manga")
      .select("id")
      .eq("id", MANGA_ID)
      .single();

    if (mangaFetchError && mangaFetchError.code !== "PGRST116") { // PGRST116 means row not found
      throw new Error(`Failed to check existing manga: ${mangaFetchError.message}`);
    }

    if (!existingManga) {
      console.log(`⚠️ Manga '${MANGA_ID}' not found in DB. Creating placeholder metadata...`);
      const { error: mangaInsertError } = await supabase
        .from("manga")
        .insert({
          id: MANGA_ID,
          title: MANGA_ID.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          cover: pageUrls[0] || "", // fallback to page 1 for cover
          description: "Manga pages uploaded via ingestion worker.",
          genres: ["Imported"],
          popularity: 1,
          is_original: true
        });

      if (mangaInsertError) {
        throw new Error(`Failed to create manga placeholder: ${mangaInsertError.message}`);
      }
      console.log(`✅ Placeholder manga '${MANGA_ID}' created.`);
    }

    // 6.2 Upsert the chapter details
    const { error: chapterUpsertError } = await supabase
      .from("chapters")
      .upsert({
        id: CHAPTER_ID,
        manga_id: MANGA_ID,
        title: cleanTitle,
        release_date: releaseDate,
        pages: pageUrls,
        created_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (chapterUpsertError) {
      throw new Error(`Failed to save chapter to Supabase: ${chapterUpsertError.message}`);
    }

    console.log(`✅ Chapter '${CHAPTER_TITLE}' saved to database successfully.`);

  } catch (err) {
    console.error("❌ INGESTION FAILED:", err);
    process.exit(1);
  } finally {
    // Local cleanup of temporary ZIP and extracted files
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
    if (fs.existsSync(extractedDir)) {
      fs.rmSync(extractedDir, { recursive: true, force: true });
    }
    console.log("🏁 Ingestion runner finished.");
  }
}

main();
