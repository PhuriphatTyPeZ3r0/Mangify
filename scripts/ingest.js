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

const {
  MANGA_ID,
  CHAPTER_ID,
  CHAPTER_TITLE,
  ZIP_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GITHUB_REPOSITORY
} = process.env;

// Initialize Supabase client
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
        title: CHAPTER_TITLE,
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
