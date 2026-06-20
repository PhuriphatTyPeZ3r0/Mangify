const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Load env variables from .env.local
const envPath = path.join(__dirname, "../.env.local");
let supabaseUrl = "";
let supabaseKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim().replace(/^"|"$/g, "");
  if (keyMatch) supabaseKey = keyMatch[1].trim().replace(/^"|"$/g, "");
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Could not find Supabase credentials in .env.local");
  process.exit(1);
}

const schemas = ["public", "dev", "test", "uat"];

async function main() {
  console.log("🚀 Starting Pinterest Profile Avatar Purge & Switch...");

  // 1. Get old cache containing Pinterest URL mappings from Git history
  let oldCache = {};
  try {
    console.log("📜 Retrieving previous cache with Pinterest mappings from git commit 03e1f1f...");
    const oldCacheData = execSync("git show 03e1f1f:src/data/manga-avatars-cache.json", { stdio: ["pipe", "pipe", "ignore"] }).toString();
    oldCache = JSON.parse(oldCacheData);
    console.log(`✅ Loaded old cache with ${Object.keys(oldCache).length} mangas.`);
  } catch (err) {
    console.warn("⚠️ Warning: Could not retrieve old cache from git history. Fallback mode: unknown Pinterest URLs will be set to NULL.", err.message);
  }

  // 2. Load the current clean cache (Fandom Wiki only)
  const currentCachePath = path.join(__dirname, "../src/data/manga-avatars-cache.json");
  let currentCache = {};
  if (fs.existsSync(currentCachePath)) {
    currentCache = JSON.parse(fs.readFileSync(currentCachePath, "utf-8"));
    console.log(`✅ Loaded current cache with ${Object.keys(currentCache).length} mangas.`);
  } else {
    console.error("❌ Current cache file not found! Please build it first.");
    process.exit(1);
  }

  // 3. Map Pinterest URLs to manga IDs
  const pinToMangaMap = new Map();
  for (const [mangaId, urls] of Object.entries(oldCache)) {
    if (Array.isArray(urls)) {
      for (const url of urls) {
        if (url && (url.includes("pinimg.com") || url.includes("pinterest.com"))) {
          pinToMangaMap.set(url.trim(), mangaId);
        }
      }
    }
  }
  console.log(`🔗 Mapped ${pinToMangaMap.size} Pinterest URLs to their respective manga IDs.`);

  // 4. Run cleanup on each schema
  for (const schemaName of schemas) {
    console.log(`\n🧹 Processing Schema: [${schemaName}]...`);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: schemaName }
    });

    // Check if table profiles exists by querying
    let profiles = [];
    try {
      const { data, error } = await supabase.from("profiles").select("id, avatar_url");
      if (error) {
        console.log(`  ℹ️ Schema "${schemaName}" is empty or profiles table does not exist. Skipping.`);
        continue;
      }
      profiles = data || [];
    } catch (e) {
      console.log(`  ℹ️ Schema "${schemaName}" is not accessible. Skipping.`);
      continue;
    }

    console.log(`  Found ${profiles.length} profiles to check in [${schemaName}].`);
    let updatedCount = 0;

    for (const profile of profiles) {
      const avatarUrl = profile.avatar_url;
      if (!avatarUrl) continue;

      const isPinterest = avatarUrl.includes("pinimg.com") || avatarUrl.includes("pinterest.com");
      if (!isPinterest) continue;

      console.log(`    ⚠️ Found Pinterest URL for profile ID: ${profile.id}`);
      console.log(`      Current URL: ${avatarUrl.substring(0, 80)}...`);

      // Try to find the manga it belongs to
      const mangaId = pinToMangaMap.get(avatarUrl.trim());
      let newAvatarUrl = null;

      if (mangaId) {
        const replacementAvatars = currentCache[mangaId];
        if (replacementAvatars && replacementAvatars.length > 0) {
          newAvatarUrl = replacementAvatars[0];
          console.log(`      💡 Matched manga: "${mangaId}". Replacing with Fandom/cover avatar: ${newAvatarUrl.substring(0, 80)}...`);
        } else {
          console.log(`      💡 Matched manga: "${mangaId}" but no replacement avatars found. Resetting to NULL.`);
        }
      } else {
        console.log(`      🔍 No exact match found in old cache. Resetting to NULL.`);
      }

      // Perform DB Update
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
        .eq("id", profile.id);

      if (updateError) {
        console.error(`      ❌ Error updating profile ${profile.id}:`, updateError.message);
      } else {
        console.log(`      ✅ Successfully updated profile.`);
        updatedCount++;
      }
    }

    console.log(`  🎉 Finished [${schemaName}]: Updated ${updatedCount} profiles.`);
  }

  console.log("\n🏁 Pinterest profile avatar cleanup process completed successfully.");
}

main().catch(console.error);
