const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Read and parse .env.local
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

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function syncChapters() {
  const { demoManga } = require("../src/data/mangaData.js");
  
  const kangLim = demoManga.find(m => m.id === "webtoon-character-kang-lim");
  if (!kangLim) {
    console.error("Na Kang Lim not found in data");
    return;
  }

  const chapters = kangLim.chapters;
  console.log(`Found ${chapters.length} chapters. Syncing to Supabase...`);

  // Using promise.all in batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);
    console.log(`Syncing batch ${i / batchSize + 1} (${batch.length} chapters)...`);
    
    const promises = batch.map(ch => {
      return supabase
        .from("chapters")
        .upsert({
          id: ch.id,
          manga_id: "webtoon-character-kang-lim",
          title: ch.title,
          pages: ch.pages,
          created_at: new Date().toISOString()
        }, { onConflict: "id" });
    });

    const results = await Promise.all(promises);
    results.forEach((res, idx) => {
      if (res.error) {
        console.error(`Error syncing ${batch[idx].title}:`, res.error.message);
      }
    });
  }

  console.log("Sync complete!");
}

syncChapters().catch(console.error);
