import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "../../../lib/supabaseClient";

// Serverless runtime memory cache for dynamically fetched new mangas
const runtimeCache = new Map<string, string[]>();

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

// Extract core keywords from title for validation
function getCoreKeywords(title: string): string[] {
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
function isMatch(resultTitle: string, mangaCleanTitle: string): boolean {
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
function getHighQualityPinterestUrl(url: string): string {
  return url.replace(/i\.pinimg\.com\/(200x150|236x|474x|564x)\//, "i.pinimg.com/736x/");
}

async function getVqdToken(query: string): Promise<string> {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
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

function getGlobalUsedUrls(): Set<string> {
  const used = new Set<string>();
  try {
    const cachePath = path.join(process.cwd(), "src/data/manga-avatars-cache.json");
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      for (const urls of Object.values(cache)) {
        if (Array.isArray(urls)) {
          for (const url of urls) {
            used.add(url as string);
          }
        }
      }
    }
  } catch (err) {
    // ignore
  }
  return used;
}

async function searchPinterestAvatars(cleanTitle: string, globalUsedUrls: Set<string>): Promise<string[]> {
  const query = `${cleanTitle} character icon site:pinterest.com -text -logo -bubble -panel -manhua -manga -chapter`;
  const vqd = await getVqdToken(query);
  const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`;

  const imgResponse = await fetch(imagesUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });

  if (!imgResponse.ok) {
    throw new Error(`Failed to fetch images list: ${imgResponse.statusText}`);
  }

  const data = await imgResponse.json();
  const results = data.results || [];
  
  const urls: string[] = [];
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

async function fetchPinterestAvatars(title: string, originalTitle: string | null): Promise<string[] | null> {
  const cleanTitle = cleanMangaTitleForSearch(title);
  const globalUsedUrls = getGlobalUsedUrls();
  
  let urls: string[] = [];
  try {
    urls = await searchPinterestAvatars(cleanTitle, globalUsedUrls);
    
    // Fallback: Alternative English titles if we got fewer than 4 results
    if (urls.length < 4 && originalTitle) {
      const altTitles = originalTitle.split(",")
        .map(t => t.trim())
        .filter(t => t && !/[\u0e00-\u0e7f]/.test(t) && !/[\u4e00-\u9fa5\uac00-\ud7af]/.test(t) && t.length > 3);
        
      for (const alt of altTitles) {
        const cleanedAlt = cleanMangaTitleForSearch(alt);
        if (cleanedAlt && cleanedAlt !== cleanTitle) {
          try {
            const altUrls = await searchPinterestAvatars(cleanedAlt, globalUsedUrls);
            for (const au of altUrls) {
              if (!urls.includes(au)) {
                urls.push(au);
              }
            }
            if (urls.length >= 6) break;
          } catch (e) {
            // ignore failure for individual alt search
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[AvatarSearch] Dynamic search failed for ${title}:`, err.message);
  }

  return urls.length > 0 ? urls : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mangaId = searchParams.get("mangaId");

  if (!mangaId) {
    return NextResponse.json({ error: "Missing mangaId parameter" }, { status: 400 });
  }

  // 1. Check serverless memory cache first
  if (runtimeCache.has(mangaId)) {
    return NextResponse.json({ urls: runtimeCache.get(mangaId) }, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" }
    });
  }

  // 2. Check local JSON cache file
  try {
    const cachePath = path.join(process.cwd(), "src/data/manga-avatars-cache.json");
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      const urls = cache[mangaId];
      if (urls && Array.isArray(urls)) {
        return NextResponse.json({ urls }, {
          headers: { "Cache-Control": "public, max-age=604800, s-maxage=604800" }
        });
      }
    }
  } catch (err: any) {
    console.warn("[AvatarSearch] Local cache read error:", err.message);
  }

  // 3. Fallback: Query Supabase for new manga details and search dynamically
  try {
    const { data: manga, error: dbError } = await supabase
      .from("manga")
      .select("title, original_title, cover")
      .eq("id", mangaId)
      .single();

    if (dbError || !manga) {
      return NextResponse.json({ urls: [] });
    }

    const urls = await fetchPinterestAvatars(manga.title, manga.original_title);
    const resultUrls = urls && urls.length > 0 ? urls : [manga.cover];

    // Cache in serverless memory
    runtimeCache.set(mangaId, resultUrls);

    return NextResponse.json({ urls: resultUrls }, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
