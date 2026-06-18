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
  if (title.includes(",")) {
    const parts = title.split(",");
    for (const part of parts) {
      const cleanPart = part.trim();
      if (/^[a-zA-Z0-9\s':\-,!]+$/.test(cleanPart)) {
        return cleanPart;
      }
    }
    return parts[0].trim();
  }

  const englishMatch = title.match(/^[a-zA-Z0-9\s':\-,!]{3,}/);
  if (englishMatch) {
    return englishMatch[0].trim();
  }

  return title.split(/[\(\)\[\]]/)[0].trim();
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

async function fetchPinterestAvatars(title) {
  const query = `${title} main character icon site:pinterest.com`;
  try {
    const vqd = await getVqdToken(query);
    const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`;

    const imgResponse = await fetch(imagesUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    if (imgResponse.ok) {
      const data = await imgResponse.json();
      if (data.results && data.results.length > 0) {
        // Collect up to 8 unique Pinterest image URLs
        const urls = [];
        for (const res of data.results) {
          if (res.image && res.image.startsWith("http") && !urls.includes(res.image)) {
            urls.push(res.image);
            if (urls.length >= 8) break;
          }
        }
        if (urls.length > 0) return urls;
      }
    }
  } catch (err) {
    console.warn(`[AvatarFetch] Pinterest search failed for "${title}":`, err.message);
  }

  // Fallback to general search without site:pinterest.com
  const generalQuery = `${title} main character icon`;
  try {
    const vqd = await getVqdToken(generalQuery);
    const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(generalQuery)}&vqd=${vqd}&o=json`;

    const imgResponse = await fetch(imagesUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    if (imgResponse.ok) {
      const data = await imgResponse.json();
      if (data.results && data.results.length > 0) {
        const urls = [];
        for (const res of data.results) {
          if (res.image && res.image.startsWith("http") && !urls.includes(res.image)) {
            urls.push(res.image);
            if (urls.length >= 8) break;
          }
        }
        if (urls.length > 0) return urls;
      }
    }
  } catch (err) {
    console.warn(`[AvatarFetch] General fallback failed for "${title}":`, err.message);
  }

  return null;
}

// Delay helper to prevent DDG rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 Starting Pinterest Avatar Pre-fetcher...");
  const { data: mangas, error } = await supabase.from("manga").select("id, title, cover");
  if (error) {
    console.error("Failed to query mangas:", error.message);
    process.exit(1);
  }

  console.log(`Loaded ${mangas.length} mangas from database.`);
  
  // Ensure data directory exists
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

  for (let i = 0; i < mangas.length; i++) {
    const m = mangas[i];
    const cleanedTitle = cleanMangaTitleForSearch(m.title);

    // Skip if already cached and contains multiple results
    if (cache[m.id] && cache[m.id].length > 1) {
      console.log(`[${i + 1}/${mangas.length}] "${m.title}" already cached. Skipping.`);
      continue;
    }

    console.log(`[${i + 1}/${mangas.length}] Fetching avatars for: "${m.title}" (Cleaned: "${cleanedTitle}")...`);
    const urls = await fetchPinterestAvatars(cleanedTitle);

    if (urls && urls.length > 0) {
      cache[m.id] = urls;
      console.log(`  -> Found ${urls.length} avatar icons.`);
    } else {
      cache[m.id] = [m.cover];
      console.log(`  -> Fallback to cover image.`);
    }

    // Save cache incrementally in case of interruption
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");

    // Sleep for 1.5 seconds between requests to avoid rate limits
    await sleep(1500);
  }

  console.log("✅ Done! Cache saved to src/data/manga-avatars-cache.json");
}

main();
