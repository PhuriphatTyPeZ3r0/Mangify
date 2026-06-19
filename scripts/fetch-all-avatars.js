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

// Convert to HQ Pinterest URL
function getHighQualityPinterestUrl(url) {
  return url.replace(/i\.pinimg\.com\/(200x150|236x|474x|564x)\//, "i.pinimg.com/736x/");
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
  const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`;

  const imgResponse = await fetch(imagesUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    }
  });

  if (!imgResponse.ok) {
    throw new Error(`Failed to fetch images list: ${imgResponse.statusText}`);
  }

  const data = await imgResponse.json();
  return data.results || [];
}

// Scrape Fandom Character List
async function getFandomCharacters(mangaTitle) {
  const query = `"${mangaTitle}" fandom wiki characters`;
  console.log(`  🔍 Searching Fandom Wiki for: "${query}"...`);
  
  try {
    const searchResults = await executeSearch(query);
    
    // Find the first result that is a Fandom wiki URL
    const wikiResult = searchResults.find(res => res.url && res.url.includes("fandom.com/wiki/"));
    if (!wikiResult) {
      console.log("  ⚠️ No Fandom Wiki page found for this manga.");
      return [];
    }

    const wikiUrl = wikiResult.url;
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
    // We clean and filter them
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

    while ((match = linkPattern.exec(html)) !== null) {
      const pathSegment = match[1].trim();
      const rawName = match[2].trim();
      const lowerSegment = pathSegment.toLowerCase();

      // Filter out utility links, tags, and formatting tags inside link text
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
        // Normalize name: Dowan_Ha -> Dowan Ha
        const normalizedName = rawName.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
        charactersMap.set(normalizedName.toLowerCase(), normalizedName);
      }
    }

    const uniqueCharacters = Array.from(charactersMap.values());
    console.log(`  ✨ Found ${uniqueCharacters.length} potential characters on Wiki.`);
    
    // Return first 8 main characters (which typically appear first in Wiki structures)
    return uniqueCharacters.slice(0, 8);
  } catch (err) {
    console.warn(`  ⚠️ Error scraping Fandom characters: ${err.message}`);
    return [];
  }
}

// Search Pinterest for specific character
async function searchPinterestAvatars(mangaTitle, cleanTitle, characterName, globalUsedUrls) {
  const queryTerm = characterName ? `${cleanTitle} ${characterName}` : cleanTitle;
  const query = `${queryTerm} character icon site:pinterest.com -text -logo -bubble -panel -manhua -manga -chapter`;
  
  let retries = 3;
  let results = [];
  
  while (retries > 0) {
    try {
      results = await executeSearch(query);
      break;
    } catch (err) {
      retries--;
      console.warn(`    Search failed for "${query}". Retries left: ${retries}. Error: ${err.message}`);
      if (retries > 0) await sleep(10000);
      else throw err;
    }
  }

  const urls = [];
  const textExclusions = ["panel", "chapter", "bubble", "quote", "text", "page", "logo", "wallpaper", "edit", "writing", "sub", "scan", "scanlation"];
  
  for (const res of results) {
    if (res.image && res.image.includes("pinimg.com")) {
      const hqUrl = getHighQualityPinterestUrl(res.image);
      const titleLower = res.title.toLowerCase();
      
      // Filter out non-avatars
      const hasExclusion = textExclusions.some(exc => titleLower.includes(exc));
      if (!hasExclusion && !urls.includes(hqUrl) && !globalUsedUrls.has(hqUrl)) {
        urls.push(hqUrl);
        if (urls.length >= 2) break; // We only need 1-2 high-quality pins per character to diversify
      }
    }
  }
  return urls;
}

async function main() {
  console.log("🚀 Starting Fandom-Aware Pinterest Avatar Scraper...");
  
  const { data: mangas, error } = await supabase.from("manga").select("id, title, original_title, cover");
  if (error) {
    console.error("Failed to query mangas:", error.message);
    process.exit(1);
  }

  console.log(`Loaded ${mangas.length} mangas from database.`);
  
  const dataDir = path.join(__dirname, "../src/data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

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

  // Set of all used URLs to enforce uniqueness across all mangas
  const globalUsedUrls = new Set();
  for (const [mangaId, urls] of Object.entries(cache)) {
    if (Array.isArray(urls)) {
      for (const url of urls) {
        globalUsedUrls.add(url);
      }
    }
  }

  const forceRefresh = process.argv.includes("--force");

  for (let i = 0; i < mangas.length; i++) {
    const m = mangas[i];
    const cleanedTitle = cleanMangaTitleForSearch(m.title);

    // If cache is already healthy and we're not forcing refresh, skip
    if (cache[m.id] && cache[m.id].length >= 4 && !forceRefresh) {
      console.log(`[${i + 1}/${mangas.length}] "${m.title}" has ${cache[m.id].length} cached avatars. Skipping.`);
      continue;
    }

    console.log(`[${i + 1}/${mangas.length}] Scraping avatars for: "${m.title}"...`);
    
    // 1. Try to get characters from Fandom Wiki
    const characters = await getFandomCharacters(cleanedTitle);
    let allUrls = [];

    if (characters.length > 0) {
      console.log(`  👥 Specific characters to search: ${characters.join(", ")}`);
      
      for (const charName of characters) {
        try {
          console.log(`    🔍 Fetching avatar for: "${charName}"`);
          const charUrls = await searchPinterestAvatars(m.title, cleanedTitle, charName, globalUsedUrls);
          charUrls.forEach(u => {
            if (!allUrls.includes(u)) {
              allUrls.push(u);
              globalUsedUrls.add(u);
            }
          });
          // Avoid spamming DuckDuckGo search endpoint
          await sleep(2500);
        } catch (e) {
          console.warn(`    ⚠️ Failed searching for character ${charName}: ${e.message}`);
        }
        
        // Target: 6-8 avatars per manga
        if (allUrls.length >= 8) break;
      }
    }

    // 2. Fallback tier 1: General search if Fandom failed or returned no results
    if (allUrls.length < 4) {
      console.log(`  ⚠️ Fallback Tier 1: Running general search for "${cleanedTitle}"...`);
      try {
        const generalUrls = await searchPinterestAvatars(m.title, cleanedTitle, null, globalUsedUrls);
        generalUrls.forEach(u => {
          if (!allUrls.includes(u)) {
            allUrls.push(u);
            globalUsedUrls.add(u);
          }
        });
      } catch (e) {
        console.warn(`    ⚠️ General search failed: ${e.message}`);
      }
    }

    // 3. Fallback tier 2: Cover image as final option
    if (allUrls.length === 0) {
      console.log("  ⚠️ Fallback Tier 2: Using manga cover.");
      allUrls.push(m.cover);
    }

    // Save manga avatars cache
    cache[m.id] = allUrls.slice(0, 8);
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    console.log(`  ✅ Finished: Cached ${cache[m.id].length} avatars.`);
    
    // Wait between mangas to avoid rate limits
    await sleep(4000);
  }

  console.log("🏁 Scraper finished successfully. Cache updated.");
}

main().catch(console.error);
