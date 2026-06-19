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

async function executeSearch(query: string): Promise<any[]> {
  const vqd = await getVqdToken(query);
  const jsonUrl = `https://duckduckgo.com/d.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`;

  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch web results: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

interface CharacterInfo {
  name: string;
  url: string;
}

// Scrape Fandom Character List
async function getFandomCharacters(mangaTitle: string): Promise<CharacterInfo[]> {
  const query = `"${mangaTitle}" fandom wiki characters`;
  
  try {
    const searchResults = await executeSearch(query);
    
    // Find the first result that is a Fandom wiki URL
    const wikiResult = searchResults.find(res => res.u && res.u.includes("fandom.com/wiki/"));
    if (!wikiResult) {
      return [];
    }

    const wikiUrl = wikiResult.u;
    const response = await fetch(wikiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const linkPattern = /href="\/wiki\/([^":?#]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    const charactersMap = new Map<string, CharacterInfo>();
    
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

    return Array.from(charactersMap.values()).slice(0, 8);
  } catch (err) {
    return [];
  }
}

// Scrape character OpenGraph image
async function getCharacterImageFromFandom(charUrl: string): Promise<string | null> {
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
    // ignore
  }
  return null;
}

async function fetchFandomAvatars(title: string): Promise<string[] | null> {
  const cleanTitle = cleanMangaTitleForSearch(title);
  const characters = await getFandomCharacters(cleanTitle);
  if (characters.length === 0) return null;

  const urls: string[] = [];
  for (const char of characters) {
    const imgUrl = await getCharacterImageFromFandom(char.url);
    if (imgUrl && !urls.includes(imgUrl)) {
      urls.push(imgUrl);
    }
    if (urls.length >= 8) break;
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

    const urls = await fetchFandomAvatars(manga.title);
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
