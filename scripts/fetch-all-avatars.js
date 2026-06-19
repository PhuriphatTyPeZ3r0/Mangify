const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local
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

const supabase = createClient(supabaseUrl, supabaseKey);

// Clean title
function cleanMangaTitleForSearch(title) {
  let clean = title.replace(/[\u0e00-\u0e7f]/g, ""); // Remove Thai
  clean = clean.replace(/\s+/g, " ").trim();
  clean = clean.replace(/\s+[sS]$/, ""); // Remove 'S' from Level S
  clean = clean.replace(/[:!?,\-\s]+$/, "").trim(); // Clean trailing punctuation
  clean = clean.replace(/[’‘`´]/g, "'");
  return clean;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// DuckDuckGo Search Helpers
async function getVqdToken(query) {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load DuckDuckGo page: ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(/vqd=["']([^"']+)["']/i);
  if (!match) {
    const match2 = html.match(/vqd=([^&"'\s)]+)/i);
    if (!match2) {
      throw new Error("VQD token not found in response HTML");
    }
    return match2[1];
  }
  return match[1];
}

async function executeSearch(query) {
  const vqd = await getVqdToken(query);
  const jsonUrl = `https://duckduckgo.com/d.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`;

  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch web results: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

// Scrape Fandom Character List
async function getFandomCharacters(mangaTitle) {
  const query = `"${mangaTitle}" fandom wiki characters`;
  console.log(`  🔍 Searching Fandom Wiki for: "${query}"...`);
  
  try {
    const searchResults = await executeSearch(query);
    
    // Find the first result that is a Fandom wiki URL
    const wikiResult = searchResults.find(res => res.u && res.u.includes("fandom.com/wiki/"));
    if (!wikiResult) {
      console.log("  ⚠️ No Fandom Wiki page found for this manga.");
      return [];
    }

    const wikiUrl = wikiResult.u;
    console.log(`  🌐 Found Wiki page: ${wikiUrl}`);
    
    const response = await fetch(wikiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      console.log(`  ⚠️ Failed to fetch Fandom page content: ${response.statusText}`);
      return [];
    }

    const html = await response.text();
    
    // Extract links like <a href="/wiki/CharacterName">Character Name</a>
    const linkPattern = /href="\/wiki\/([^":?#]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    const charactersMap = new Map();
    
    // Common non-character sub-routes or general wiki pages on Fandom
    const exclusions = new Set([
      "main_page", "characters", "story", "episodes", "timeline", "wiki", "gallery",
      "special", "file", "category", "lookism_wiki", "reality_quest_wiki", "questism_wiki",
      "wind_breaker_wiki", "help", "staff", "discussion", "recent_changes", "read",
      "manga", "manhwa", "chapters", "season", "volume", "arc", "creators", "author"
    ]);

    const wikiOrigin = new URL(wikiUrl).origin;

    while ((match = linkPattern.exec(html)) !== null) {
      const pathSegment = match[1].trim();
      const rawName = match[2].trim();
      const lowerSegment = pathSegment.toLowerCase();

      // Filter out utility links
      if (
        rawName && 
        !rawName.includes("<") && 
        !exclusions.has(lowerSegment) && 
        !lowerSegment.includes("category:") &&
        !lowerSegment.includes("file:") &&
        !lowerSegment.includes("special:") &&
        !lowerSegment.includes("/") &&
        rawName.length > 2 &&
        rawName.length < 35
      ) {
        const normalizedName = rawName.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
        const charWikiUrl = `${wikiOrigin}/wiki/${pathSegment}`;
        charactersMap.set(normalizedName.toLowerCase(), { name: normalizedName, url: charWikiUrl });
      }
    }

    const uniqueCharacters = Array.from(charactersMap.values());
    console.log(`  ✨ Found ${uniqueCharacters.length} potential characters on Wiki.`);
    
    // Return first 8 main characters
    return uniqueCharacters.slice(0, 8);
  } catch (err) {
    console.warn(`  ⚠️ Error scraping Fandom characters: ${err.message}`);
    return [];
  }
}

// Scrape character OpenGraph image
async function getCharacterImageFromFandom(charUrl) {
  try {
    const response = await fetch(charUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (match) {
      return match[1].trim();
    }
  } catch (e) {
    console.error(`      ⚠️ Failed to fetch character page: ${e.message}`);
  }
  return null;
}

async function main() {
  console.log("🚀 Starting Fandom-Wiki-Only Avatar Scraper...");
  
  const { data: mangas, error } = await supabase.from("manga").select("id, title, original_title, cover");
  if (error) {
    console.error("Failed to query mangas from Supabase:", error.message);
    process.exit(1);
  }

  console.log(`Loaded ${mangas.length} mangas from Supabase.`);
  
  const dataDir = path.join(__dirname, "../src/data");
  const cachePath = path.join(dataDir, "manga-avatars-cache.json");
  
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      console.log(`Loaded existing cache with ${Object.keys(cache).length} entries.`);
    } catch (e) {
      console.warn("Could not parse existing cache, starting fresh.");
    }
  }

  // Purge Pinterest URLs from all loaded cache entries
  console.log("🧹 Purging all old Pinterest (pinimg.com) URLs from cache...");
  for (const mangaId of Object.keys(cache)) {
    const originalCount = cache[mangaId].length;
    const filtered = cache[mangaId].filter(url => !url.includes("pinimg.com") && !url.includes("pinterest.com"));
    
    if (filtered.length === 0) {
      // Find this manga's cover to use as fallback if available
      const dbManga = mangas.find(m => m.id === mangaId);
      cache[mangaId] = dbManga ? [dbManga.cover] : [];
    } else {
      cache[mangaId] = filtered;
    }
    
    if (cache[mangaId].length !== originalCount) {
      console.log(`  Cleaned Pinterest URLs from: ${mangaId} (${originalCount} -> ${cache[mangaId].length})`);
    }
  }

  const forceRefresh = process.argv.includes("--force");

  for (let i = 0; i < mangas.length; i++) {
    const m = mangas[i];
    const cleanedTitle = cleanMangaTitleForSearch(m.title);

    // If cache already has clean Fandom image(s) (no Pinterest) and we're not forcing, skip
    const hasCleanCache = cache[m.id] && cache[m.id].length > 0 && cache[m.id].every(url => !url.includes("pinimg.com")) && !forceRefresh;
    if (hasCleanCache && cache[m.id][0] !== m.cover) {
      console.log(`[${i + 1}/${mangas.length}] "${m.title}" already has clean cached Fandom avatars. Skipping.`);
      continue;
    }

    console.log(`[${i + 1}/${mangas.length}] Scraping Fandom avatars for: "${m.title}"...`);
    
    // 1. Try to get characters from Fandom Wiki
    const characters = await getFandomCharacters(cleanedTitle);
    const allUrls = [];

    if (characters.length > 0) {
      console.log(`  👥 Found characters: ${characters.map(c => c.name).join(", ")}`);
      
      for (const char of characters) {
        try {
          console.log(`    🔍 Fetching avatar for: "${char.name}"...`);
          const imgUrl = await getCharacterImageFromFandom(char.url);
          if (imgUrl && !allUrls.includes(imgUrl)) {
            allUrls.push(imgUrl);
            console.log(`      ✅ Found image: ${imgUrl.substring(0, 80)}...`);
          }
          await sleep(1500); // 1.5s delay to be friendly to Fandom Wiki
        } catch (e) {
          console.warn(`    ⚠️ Failed searching for character ${char.name}: ${e.message}`);
        }
        
        // Target 8 avatars per manga
        if (allUrls.length >= 8) break;
      }
    }

    // 2. Fallback: If no Fandom images found at all, use manga cover
    if (allUrls.length === 0) {
      console.log("  ⚠️ Fallback: No Fandom characters found. Using manga cover.");
      allUrls.push(m.cover);
    }

    // Save manga avatars cache
    cache[m.id] = allUrls.slice(0, 8);
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    console.log(`  🎉 Finished: Cached ${cache[m.id].length} official avatars.`);
    
    // Wait between mangas to avoid rate limits
    await sleep(3000);
  }

  console.log("🏁 Fandom-Wiki-Only Scraper finished successfully. Cache updated.");
}

main().catch(console.error);
