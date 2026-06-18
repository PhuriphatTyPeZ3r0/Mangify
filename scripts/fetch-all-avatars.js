const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = "C:\\Base\\20-29_Work_and_Projects\\21_Active_Projects\\Mangify\\.env.local";
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

function cleanMangaTitleForSearch(title) {
  // Remove Thai Unicode characters (range \u0e00-\u0e7f)
  let clean = title.replace(/[\u0e00-\u0e7f]/g, "");
  
  // Replace double spaces and trim
  clean = clean.replace(/\s+/g, " ").trim();
  
  // Remove standalone S class at end (e.g. from "ระดับ S")
  clean = clean.replace(/\s+[sS]$/, "");
  
  // Clean dangling symbols at the end (like :, ?, !, -, ,)
  clean = clean.replace(/[:!?,\-\s]+$/, "").trim();

  // Normalize quotes
  clean = clean.replace(/[’‘`´]/g, "'");
  
  return clean;
}

// Extract core keywords from title for validation
function getCoreKeywords(title) {
  const clean = title.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = clean.split(/\s+/);
  const stopWords = new Set([
    "the", "a", "an", "of", "to", "in", "for", "with", "is", "are", "on", "at", 
    "and", "or", "from", "into", "through", "by", "about", "character", "icon", 
    "pfp", "profile", "manga", "manhua", "webtoon", "remake"
  ]);
  return words.filter(w => w.length > 1 && !stopWords.has(w));
}

// Check if search result title matches manga title core keywords
function isMatch(resultTitle, mangaCleanTitle) {
  const rTitleLower = resultTitle.toLowerCase();
  const mTitleLower = mangaCleanTitle.toLowerCase();
  
  // 1. Exclude titles suggesting text, manga panels, or chapter covers
  const textExclusions = ["panel", "chapter", "bubble", "quote", "text", "page", "logo", "wallpaper", "edit", "writing", "sub", "scan", "scanlation"];
  for (const exc of textExclusions) {
    if (rTitleLower.includes(exc)) {
      return false;
    }
  }

  // 2. Exact or partial phrase match
  const cleanMangaPhrase = mTitleLower.replace(/[^a-z0-9\s]/g, "").trim();
  const cleanResultPhrase = rTitleLower.replace(/[^a-z0-9\s]/g, "").trim();
  if (cleanResultPhrase.includes(cleanMangaPhrase) || cleanMangaPhrase.includes(cleanResultPhrase)) {
    return true;
  }
  
  // 3. Keyword match
  const coreKeywords = getCoreKeywords(mangaCleanTitle);
  if (coreKeywords.length === 0) return true; // fallback if no keywords
  
  let matchCount = 0;
  for (const word of coreKeywords) {
    if (rTitleLower.includes(word)) {
      matchCount++;
    }
  }
  
  if (coreKeywords.length === 1) {
    return matchCount >= 1;
  } else {
    const threshold = Math.max(2, Math.ceil(coreKeywords.length * 0.5));
    return matchCount >= Math.min(coreKeywords.length, threshold);
  }
}

// Convert Pinterest thumbnails/smaller sizes to high quality
function getHighQualityPinterestUrl(url) {
  return url.replace(/i\.pinimg\.com\/(200x150|236x|474x|564x)\//, "i.pinimg.com/736x/");
}

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

async function searchPinterestAvatars(title, cleanTitle, globalUsedUrls) {
  const query = `${cleanTitle} character icon site:pinterest.com -text -logo -bubble -panel -manhua -manga -chapter`;
  
  // Retry mechanism for rate limits
  let retries = 3;
  let results = [];
  
  while (retries > 0) {
    try {
      results = await executeSearch(query);
      break;
    } catch (err) {
      retries--;
      console.warn(`    Search failed for "${query}". Retries left: ${retries}. Error: ${err.message}`);
      if (retries > 0) {
        await sleep(15000); // Sleep 15s on failure to cool down IP
      } else {
        throw err;
      }
    }
  }

  const urls = [];
  for (const res of results) {
    if (res.image && res.image.includes("pinimg.com")) {
      const hqUrl = getHighQualityPinterestUrl(res.image);
      if (isMatch(res.title, cleanTitle) && !urls.includes(hqUrl) && !globalUsedUrls.has(hqUrl)) {
        urls.push(hqUrl);
        if (urls.length >= 8) break;
      }
    }
  }
  return urls;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 Starting Pinterest Avatar Pre-fetcher...");
  const { data: mangas, error } = await supabase.from("manga").select("id, title, original_title, cover");
  if (error) {
    console.error("Failed to query mangas:", error.message);
    process.exit(1);
  }

  console.log(`Loaded ${mangas.length} mangas from database.`);
  
  const dataDir = "C:\\Base\\20-29_Work_and_Projects\\21_Active_Projects\\Mangify\\src\\data";
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

  // Identify global duplicates in the current cache to clean them up
  const urlCounts = {};
  for (const [mangaId, urls] of Object.entries(cache)) {
    if (Array.isArray(urls)) {
      for (const url of urls) {
        urlCounts[url] = (urlCounts[url] || 0) + 1;
      }
    }
  }

  const duplicates = new Set();
  for (const [url, count] of Object.entries(urlCounts)) {
    if (count > 1) {
      duplicates.add(url);
    }
  }
  console.log(`Found ${duplicates.size} duplicate URLs in existing cache. They will be cleared.`);

  // Build a Set of all clean, unique URLs currently used in cache
  const globalUsedUrls = new Set();
  for (const [mangaId, urls] of Object.entries(cache)) {
    if (Array.isArray(urls)) {
      const validUrls = urls.filter(url => url.includes("pinimg.com") && !duplicates.has(url));
      cache[mangaId] = validUrls; // Clean it immediately in memory
      for (const url of validUrls) {
        globalUsedUrls.add(url);
      }
    }
  }

  for (let i = 0; i < mangas.length; i++) {
    const m = mangas[i];
    const cleanedTitle = cleanMangaTitleForSearch(m.title);

    // If it has at least 4 valid cached Pinterest URLs, we keep them and skip search!
    const forceRefresh = process.argv.includes("--force");
    const hasValidCache = cache[m.id] && cache[m.id].length >= 4 && !forceRefresh;

    if (hasValidCache) {
      console.log(`[${i + 1}/${mangas.length}] "${m.title}" has ${cache[m.id].length} valid cached avatars. Skipping.`);
      continue;
    }

    console.log(`[${i + 1}/${mangas.length}] Fetching avatars for: "${m.title}" (Cleaned: "${cleanedTitle}")...`);
    
    let urls = [];
    try {
      urls = await searchPinterestAvatars(m.title, cleanedTitle, globalUsedUrls);
      
      // Fallback: If we got fewer than 4 results, try alternative titles in original_title
      if (urls.length < 4 && m.original_title) {
        const altTitles = m.original_title.split(",")
          .map(t => t.trim())
          .filter(t => t && !/[\u0e00-\u0e7f]/.test(t) && !/[\u4e00-\u9fa5\uac00-\ud7af]/.test(t) && t.length > 3);
          
        for (const alt of altTitles) {
          const cleanedAlt = cleanMangaTitleForSearch(alt);
          if (cleanedAlt && cleanedAlt !== cleanedTitle) {
            console.log(`  -> Trying alternative title search: "${cleanedAlt}"...`);
            const altUrls = await searchPinterestAvatars(m.title, cleanedAlt, globalUsedUrls);
            for (const au of altUrls) {
              if (!urls.includes(au)) {
                urls.push(au);
              }
            }
            if (urls.length >= 6) break;
            await sleep(3500); // delay between fallbacks
          }
        }
      }
    } catch (err) {
      console.error(`  -> Failed to search for "${m.title}":`, err.message);
      // Keep existing cached entries if any, otherwise keep it as is
      if (cache[m.id] && cache[m.id].length > 0) {
        console.log(`  -> Keeping ${cache[m.id].length} existing cached urls.`);
        continue;
      }
    }

    if (urls && urls.length > 0) {
      cache[m.id] = urls;
      // Add new URLs to global set
      for (const u of urls) {
        globalUsedUrls.add(u);
      }
      console.log(`  -> Cached ${urls.length} clean avatar icons.`);
    } else {
      // If no avatars found at all, fallback to cover
      cache[m.id] = [m.cover];
      console.log(`  -> Fallback to cover image.`);
    }

    // Save cache incrementally
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");

    // Sleep for 3.5 seconds between requests to be safe
    await sleep(3500);
  }

  console.log("✅ Done! Cache saved to src/data/manga-avatars-cache.json");
}

main();
