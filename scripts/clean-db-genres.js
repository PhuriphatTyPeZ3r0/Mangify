const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load .env.local
const envPath = path.join(__dirname, "../.env.local");
let envVars = {};

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
  console.error("❌ Error: Missing Supabase credentials.");
  process.exit(1);
}

if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  supabaseUrl = "https://" + supabaseUrl;
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { cleanGenres, cleanGenresAsync } = require("../src/lib/genreUtils");

async function main() {
  console.log("Fetching all manga records...");
  const { data: mangas, error: fetchError } = await supabaseAdmin.from("manga").select("id, title, genres");
  if (fetchError) {
    console.error("Error fetching mangas:", fetchError);
    return;
  }

  console.log(`Found ${mangas.length} mangas. Processing cleanup...`);
  
  let updatedCount = 0;
  for (const manga of mangas) {
    const cleaned = await cleanGenresAsync(manga.genres);
    // Only update if the list of genres changed
    const originalSorted = JSON.stringify([...(manga.genres || [])].sort());
    const cleanedSorted = JSON.stringify([...cleaned].sort());
    
    if (originalSorted !== cleanedSorted) {
      console.log(`Updating "${manga.title}":`, manga.genres, "->", cleaned);
      const { error: updateError } = await supabaseAdmin
        .from("manga")
        .update({ genres: cleaned })
        .eq("id", manga.id);
        
      if (updateError) {
        console.error(`Error updating "${manga.title}":`, updateError.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`✅ Finished database cleanup. Updated ${updatedCount} manga records.`);
}

main();
