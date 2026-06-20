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

// DuckDuckGo Search Helpers via HTML Parser (Bypasses bot detection)
async function executeSearch(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch web results: ${response.statusText}`);
  }

  const html = await response.text();
  const results = [];
  const regex = /href="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const rawUrl = match[1];
    if (rawUrl.includes("uddg=")) {
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        const decoded = decodeURIComponent(uddgMatch[1]);
        results.push({ u: decoded });
      }
    }
  }
  return results;
}



function extractSubdomainAndTitle(urlOrSlug) {
  if (!urlOrSlug) return null;
  if (urlOrSlug.startsWith("http")) {
    try {
      const parsed = new URL(urlOrSlug);
      const host = parsed.hostname;
      const subdomain = host.split(".")[0];
      const pageTitle = parsed.pathname.replace(/^\/wiki\//, "");
      return { subdomain, pageTitle: decodeURIComponent(pageTitle) };
    } catch (e) {
      return null;
    }
  }
  return { subdomain: urlOrSlug, pageTitle: "Characters" };
}

// Fetch characters and images using Fandom MediaWiki Action API (Bypasses Cloudflare block)
async function fetchFandomAvatars(subdomain, initialPageTitle = "Characters") {
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  const exclusions = new Set([
    "main page", "characters", "story", "episodes", "timeline", "wiki", "gallery",
    "special", "file", "category", "help", "staff", "discussion", "recent changes", "read",
    "manga", "manhwa", "chapters", "season", "volume", "arc", "creators", "author", "local sitemap"
  ]);

  let characterTitles = [];

  // Approach 1: Parse specific page (usually "Characters")
  try {
    const pageToParse = initialPageTitle || "Characters";
    const url = `https://${subdomain}.fandom.com/api.php?action=parse&page=${encodeURIComponent(pageToParse)}&prop=text&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (res.ok) {
      const data = await res.json();
      const html = data.parse?.text?.["*"] || "";
      
      const linkPattern = /href="\/wiki\/([^":?#]+)"/gi;
      let match;
      const seen = new Set();
      while ((match = linkPattern.exec(html)) !== null) {
        const decoded = decodeURIComponent(match[1].replace(/_/g, " ")).trim();
        const lower = decoded.toLowerCase();
        if (decoded && !seen.has(lower) && !exclusions.has(lower) && !lower.includes("category:") && !lower.includes("file:") && !lower.includes("special:") && !lower.includes("/") && decoded.length > 2 && decoded.length < 35) {
          seen.add(lower);
          characterTitles.push(decoded);
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // Approach 2: Query Category:Characters
  if (characterTitles.length < 4) {
    try {
      const url = `https://${subdomain}.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Characters&cmlimit=25&format=json`;
      const res = await fetch(url, { headers: { "User-Agent": userAgent } });
      if (res.ok) {
        const data = await res.json();
        const members = data.query?.categorymembers || [];
        for (const member of members) {
          if (member.ns === 0 && member.title) {
            const cleanTitle = member.title.trim().replace(/^['"]|['"]$/g, "");
            const lower = cleanTitle.toLowerCase();
            if (!exclusions.has(lower) && !characterTitles.includes(cleanTitle)) {
              characterTitles.push(cleanTitle);
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Approach 3: Search "character"
  if (characterTitles.length < 4) {
    try {
      const url = `https://${subdomain}.fandom.com/api.php?action=query&list=search&srsearch=character&srlimit=20&format=json`;
      const res = await fetch(url, { headers: { "User-Agent": userAgent } });
      if (res.ok) {
        const data = await res.json();
        const results = data.query?.search || [];
        for (const result of results) {
          if (result.title) {
            const cleanTitle = result.title.trim();
            const lower = cleanTitle.toLowerCase();
            if (!exclusions.has(lower) && !characterTitles.includes(cleanTitle)) {
              characterTitles.push(cleanTitle);
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (characterTitles.length === 0) {
    if (initialPageTitle && !exclusions.has(initialPageTitle.toLowerCase())) {
      characterTitles.push(initialPageTitle.replace(/_/g, " "));
    } else {
      return null;
    }
  }

  const uniqueTitles = Array.from(new Set(characterTitles)).slice(0, 12);
  if (uniqueTitles.length === 0) return null;

  // Query pageimages for all character titles in a single request
  try {
    const url = `https://${subdomain}.fandom.com/api.php?action=query&titles=${encodeURIComponent(uniqueTitles.join("|"))}&prop=pageimages&pithumbsize=500&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      const imageUrls = [];
      
      for (const pageId of Object.keys(pages)) {
        const page = pages[pageId];
        const imgUrl = page.thumbnail?.source;
        if (imgUrl && !imageUrls.includes(imgUrl)) {
          imageUrls.push(imgUrl);
        }
      }

      return imageUrls.length > 0 ? imageUrls.slice(0, 8) : null;
    }
  } catch (e) {
    // ignore
  }

  return null;
}

async function main() {
  console.log("🚀 Starting Fandom-Wiki-Only Avatar Scraper (MediaWiki API Edition)...");
  
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

  const forceRefresh = process.argv.includes("--force");

  for (let i = 0; i < mangas.length; i++) {
    const m = mangas[i];
    const cleanedTitle = cleanMangaTitleForSearch(m.title);

    // If cache already has clean cached Fandom avatars and we're not forcing, skip
    const hasCleanCache = cache[m.id] && cache[m.id].length > 0 && !forceRefresh;
    if (hasCleanCache && cache[m.id][0] !== m.cover) {
      console.log(`[${i + 1}/${mangas.length}] "${m.title}" already has clean cached Fandom avatars. Skipping.`);
      continue;
    }

    console.log(`[${i + 1}/${mangas.length}] Resolving Fandom subdomain for: "${m.title}"...`);
    let target = null;
    
    // 1. Direct Slug Guessing
    const directSlugs = [
      m.id,
      m.id.replace(/-manga$/i, "").replace(/-manhwa$/i, "").replace(/-webtoon$/i, "")
    ];
    
    for (const slug of directSlugs) {
      const directUrl = `https://${slug}.fandom.com/api.php?action=query&meta=siteinfo&format=json`;
      try {
        const response = await fetch(directUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        if (response.ok) {
          console.log(`  🌐 Direct subdomain guess successful: ${slug}`);
          target = { subdomain: slug, pageTitle: "Characters" };
          break;
        }
      } catch (e) {
        // ignore
      }
    }
    
    // 2. DuckDuckGo HTML search fallback
    if (!target) {
      const query = `"${cleanedTitle}" fandom wiki characters`;
      console.log(`  🔍 Searching Fandom Wiki subdomain for: "${query}"...`);
      try {
        const searchResults = await executeSearch(query);
        const wikiResult = searchResults.find(res => res.u && res.u.includes("fandom.com/wiki/"));
        if (wikiResult) {
          target = extractSubdomainAndTitle(wikiResult.u);
          if (target) {
            console.log(`  🌐 Found wiki via DDG search: ${target.subdomain} (Page: ${target.pageTitle})`);
          }
        }
      } catch (err) {
        console.warn(`  ⚠️ Error searching Fandom: ${err.message}`);
      }
    }

    let allUrls = null;

    if (target) {
      console.log(`  👥 Querying Fandom MediaWiki API for: ${target.subdomain}...`);
      allUrls = await fetchFandomAvatars(target.subdomain, target.pageTitle);
    }

    if (allUrls && allUrls.length > 0) {
      console.log(`  🎉 Finished: Cached ${allUrls.length} official avatars.`);
      cache[m.id] = allUrls;
    } else {
      console.log("  ⚠️ Fallback: No Fandom characters found. Using manga cover.");
      cache[m.id] = [m.cover];
    }

    // Save cache incrementally
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    
    // Brief sleep to avoid hitting API limit
    await sleep(2000);
  }

  console.log("🏁 Fandom-Wiki-Only Scraper finished successfully. Cache updated.");
}

main().catch(console.error);
