import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "../../../lib/supabaseClient";

// Serverless runtime memory cache for dynamically fetched new mangas
const runtimeCache = new Map<string, string[]>();

function cleanMangaTitleForSearch(title: string): string {
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

async function fetchPinterestAvatars(title: string): Promise<string[] | null> {
  const query = `${title} main character icon site:pinterest.com`;
  try {
    const vqd = await getVqdToken(query);
    const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`;

    const imgResponse = await fetch(imagesUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (imgResponse.ok) {
      const data = await imgResponse.json();
      if (data.results && data.results.length > 0) {
        const urls: string[] = [];
        for (const res of data.results) {
          if (res.image && res.image.startsWith("http") && !urls.includes(res.image)) {
            urls.push(res.image);
            if (urls.length >= 8) break;
          }
        }
        if (urls.length > 0) return urls;
      }
    }
  } catch (err: any) {
    console.warn(`[AvatarSearch] Dynamic search failed for ${title}:`, err.message);
  }

  // General fallback search
  const generalQuery = `${title} main character icon`;
  try {
    const vqd = await getVqdToken(generalQuery);
    const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(generalQuery)}&vqd=${vqd}&o=json`;

    const imgResponse = await fetch(imagesUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (imgResponse.ok) {
      const data = await imgResponse.json();
      if (data.results && data.results.length > 0) {
        const urls: string[] = [];
        for (const res of data.results) {
          if (res.image && res.image.startsWith("http") && !urls.includes(res.image)) {
            urls.push(res.image);
            if (urls.length >= 8) break;
          }
        }
        if (urls.length > 0) return urls;
      }
    }
  } catch (err: any) {
    console.error(`[AvatarSearch] Dynamic fallback search failed for ${title}:`, err.message);
  }

  return null;
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
      .select("title, cover")
      .eq("id", mangaId)
      .single();

    if (dbError || !manga) {
      return NextResponse.json({ urls: [] });
    }

    const cleanedTitle = cleanMangaTitleForSearch(manga.title);
    const urls = await fetchPinterestAvatars(cleanedTitle);
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
