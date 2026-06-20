import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "../../../lib/supabaseClient";



function cleanMangaTitleForSearch(title: string): string {
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

// DuckDuckGo Search Helpers via HTML Parser (Bypasses bot detection)
async function executeSearch(query: string): Promise<any[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch web results: ${response.statusText}`);
  }

  const html = await response.text();
  const results: any[] = [];
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


function extractSubdomainAndTitle(urlOrSlug: string): { subdomain: string; pageTitle: string } | null {
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
async function fetchFandomAvatars(subdomain: string, initialPageTitle: string = "Characters"): Promise<string[] | null> {
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  const exclusions = new Set([
    "main page", "characters", "story", "episodes", "timeline", "wiki", "gallery",
    "special", "file", "category", "help", "staff", "discussion", "recent changes", "read",
    "manga", "manhwa", "chapters", "season", "volume", "arc", "creators", "author", "local sitemap"
  ]);

  let characterTitles: string[] = [];

  // Approach 1: Parse Characters Page
  try {
    const pageToParse = initialPageTitle || "Characters";
    const url = `https://${subdomain}.fandom.com/api.php?action=parse&page=${encodeURIComponent(pageToParse)}&prop=text&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (res.ok) {
      const data = await res.json();
      const html = data.parse?.text?.["*"] || "";
      
      const linkPattern = /href="\/wiki\/([^":?#]+)"/gi;
      let match;
      const seen = new Set<string>();
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

  // Query pageimages
  try {
    const url = `https://${subdomain}.fandom.com/api.php?action=query&titles=${encodeURIComponent(uniqueTitles.join("|"))}&prop=pageimages&pithumbsize=500&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      const imageUrls: string[] = [];
      
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mangaId = searchParams.get("mangaId");

  if (!mangaId) {
    return NextResponse.json({ error: "Missing mangaId parameter" }, { status: 400 });
  }



  // 2. Check local JSON cache file
  try {
    const cachePath = path.join(process.cwd(), "src/data/manga-avatars-cache.json");
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      const urls = cache[mangaId];
      if (urls && Array.isArray(urls)) {
        return NextResponse.json({ urls }, {
          headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" }
        });
      }
    }
  } catch (err: any) {
    console.warn("[AvatarSearch] Local cache read error:", err.message);
  }

  // 3. Fallback: Query Supabase for new manga details and search dynamically from Fandom Wiki
  try {
    const { data: manga, error: dbError } = await supabase
      .from("manga")
      .select("title, original_title, cover")
      .eq("id", mangaId)
      .single();

    if (dbError || !manga) {
      return NextResponse.json({ urls: [] });
    }

    const cleanTitle = cleanMangaTitleForSearch(manga.title);
    let target = null;
    
    // 1. Direct Slug Guessing
    const directSlugs = [
      mangaId,
      mangaId.replace(/-manga$/i, "").replace(/-manhwa$/i, "").replace(/-webtoon$/i, "")
    ];
    
    for (const slug of directSlugs) {
      const directUrl = `https://${slug}.fandom.com/api.php?action=query&meta=siteinfo&format=json`;
      try {
        const response = await fetch(directUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        if (response.ok) {
          target = { subdomain: slug, pageTitle: "Characters" };
          break;
        }
      } catch (e) {
        // ignore
      }
    }
    
    // 2. DuckDuckGo HTML search fallback
    if (!target) {
      const query = `"${cleanTitle}" fandom wiki characters`;
      try {
        const searchResults = await executeSearch(query);
        const wikiResult = searchResults.find(res => res.u && res.u.includes("fandom.com/wiki/"));
        if (wikiResult) {
          target = extractSubdomainAndTitle(wikiResult.u);
        }
      } catch (err) {
        // ignore
      }
    }

    let urls = null;
    if (target) {
      urls = await fetchFandomAvatars(target.subdomain, target.pageTitle);
    }
    const resultUrls = urls && urls.length > 0 ? urls : [manga.cover];



    return NextResponse.json({ urls: resultUrls }, {
      headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
