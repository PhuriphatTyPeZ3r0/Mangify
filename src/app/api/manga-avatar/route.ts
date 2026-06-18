import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache to store resolved avatar URLs (wipes on server restart, but highly effective for session caching)
const avatarCache = new Map<string, string>();

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

async function searchPinterestAvatar(title: string): Promise<string | null> {
  // Try with Pinterest first
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
        // Find first result that has a valid image URL
        const firstImg = data.results[0].image;
        if (firstImg && firstImg.startsWith("http")) {
          return firstImg;
        }
      }
    }
  } catch (err) {
    console.warn(`[AvatarSearch] Pinterest search failed for ${title}:`, err);
  }

  // Fallback: search generally without site:pinterest.com
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
        const firstImg = data.results[0].image;
        if (firstImg && firstImg.startsWith("http")) {
          return firstImg;
        }
      }
    }
  } catch (err) {
    console.error(`[AvatarSearch] General fallback search failed for ${title}:`, err);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");

  if (!title) {
    return NextResponse.json({ error: "Missing title parameter" }, { status: 400 });
  }

  const cacheKey = title.trim().toLowerCase();
  if (avatarCache.has(cacheKey)) {
    const cachedUrl = avatarCache.get(cacheKey);
    return NextResponse.json({ url: cachedUrl }, {
      headers: {
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
      }
    });
  }

  const avatarUrl = await searchPinterestAvatar(title);

  if (avatarUrl) {
    avatarCache.set(cacheKey, avatarUrl);
    return NextResponse.json({ url: avatarUrl }, {
      headers: {
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
      }
    });
  }

  return NextResponse.json({ url: null }, { status: 404 });
}
