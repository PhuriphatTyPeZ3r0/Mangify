import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseClient";

const genreTranslationMap: Record<string, string> = {
  "Action": "ศิลปะการต่อสู้-แอคชั่น",
  "Adventure": "ผจญภัย",
  "Comedy": "ตลก",
  "Drama": "ดราม่า",
  "Fantasy": "แฟนตาซี",
  "Harem": "ฮาเร็ม",
  "Historical": "ย้อนยุค",
  "Martial Arts": "ศิลปะการต่อสู้-แอคชั่น",
  "Mystery": "ลึกลับ",
  "Psychological": "จิตวิทยา",
  "Romance": "โรแมนติก",
  "School Life": "ชีวิตในโรงเรียน",
  "Sci-fi": "ไซไฟ",
  "Seinen": "เซเน็น",
  "Shounen": "โชเน็น",
  "Slice of Life": "ชีวิตประจำวัน",
  "Supernatural": "เหนือธรรมชาติ",
  "Tragedy": "โศกนาฏกรรม",
  "ภัยภิบัติ": "ภัยพิบัติ",
};

const ignoredTags = new Set(["Webtoon", "Kakao"]);

function cleanGenres(genres: string[]): string[] {
  if (!genres || !Array.isArray(genres)) return [];
  const mapped = genres
    .map(g => {
      const trimmed = g.trim();
      return genreTranslationMap[trimmed] || trimmed;
    })
    .filter(g => !ignoredTags.has(g) && g !== "");
  return Array.from(new Set(mapped));
}

export async function GET() {
  try {
    // 1. Fetch all manga records from Supabase using supabaseAdmin
    const { data: mangasData, error: mangaError } = await supabaseAdmin
      .from("manga")
      .select("*")
      .order("created_at", { ascending: false });

    if (mangaError) {
      console.warn("⚠️ Failed to fetch manga catalog from DB:", mangaError.message);
      return NextResponse.json({ mangas: [] });
    }

    if (!mangasData || mangasData.length === 0) {
      return NextResponse.json({ mangas: [] });
    }

    // 2. Fetch all chapters using supabaseAdmin
    const { data: chaptersData, error: chaptersError } = await supabaseAdmin
      .from("chapters")
      .select("*")
      .order("created_at", { ascending: true });

    if (chaptersError) {
      console.warn("⚠️ Failed to fetch chapters from DB:", chaptersError.message);
      return NextResponse.json({ mangas: [] });
    }

    // 3. Fetch bookmarks counts to aggregate
    const { data: bookmarksData, error: bookmarksError } = await supabaseAdmin
      .from("bookmarks")
      .select("manga_id, user_id");

    if (bookmarksError) {
      console.warn("⚠️ Failed to fetch bookmarks from DB:", bookmarksError.message);
    }

    // 4. Fetch reading progress to aggregate unique user views
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from("reading_progress")
      .select("manga_id, user_id");

    if (progressError) {
      console.warn("⚠️ Failed to fetch reading progress from DB:", progressError.message);
    }

    // Aggregate bookmarks
    const bookmarkCounts: Record<string, number> = {};
    if (bookmarksData) {
      bookmarksData.forEach((b: any) => {
        if (b.manga_id) {
          bookmarkCounts[b.manga_id] = (bookmarkCounts[b.manga_id] || 0) + 1;
        }
      });
    }

    // Aggregate unique readers (views)
    const progressUsers: Record<string, Set<string>> = {};
    if (progressData) {
      progressData.forEach((p: any) => {
        if (p.manga_id && p.user_id) {
          if (!progressUsers[p.manga_id]) {
            progressUsers[p.manga_id] = new Set();
          }
          progressUsers[p.manga_id].add(p.user_id);
        }
      });
    }

    // 5. Map database rows to the client-side Manga interface
    const mappedMangas = mangasData.map((m: any) => {
      const mangaChapters = (chaptersData || [])
        .filter((ch: any) => ch.manga_id === m.id)
        .map((ch: any) => ({
          id: ch.id,
          title: ch.title,
          pages: ch.pages,
          created_at: ch.created_at // Needed for "New Updates" logic
        }));

      // Naturally sort chapters
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
      mangaChapters.sort((a: any, b: any) => collator.compare(a.title, b.title));

      // Get latest chapter date
      const lastUpdate = mangaChapters.length > 0 
        ? new Date(Math.max(...mangaChapters.map(c => new Date(c.created_at).getTime()))).toISOString()
        : m.created_at;

      // Parse views (e.g., "5.5M" -> 5500000) for internal ranking fallback
      const parseViews = (v: string) => {
        if (!v) return 0;
        const clean = v.toUpperCase();
        if (clean.endsWith('M')) return parseFloat(clean) * 1000000;
        if (clean.endsWith('K')) return parseFloat(clean) * 1000;
        return parseFloat(clean) || 0;
      };

      const realViews = progressUsers[m.id]?.size || 0;
      const realBookmarks = bookmarkCounts[m.id] || 0;

      return {
        id: m.id,
        title: m.title,
        author: m.author || "Unknown",
        cover: m.cover || "",
        description: m.description || "",
        genres: cleanGenres(m.genres || []),
        popularity: m.popularity || 0,
        isOriginal: m.is_original,
        originalTitle: m.original_title || "",
        artist: m.artist || "",
        status: m.status || "Ongoing",
        type: m.manga_type || "Manhwa",
        year: m.release_year || null,
        views: m.views_count || "0",
        numericViews: parseViews(m.views_count), // Used for ranking fallback
        lastUpdate, // Used for sorting new updates
        chapters: mangaChapters,
        realViews,
        realBookmarks
      };
    });

    return NextResponse.json({ mangas: mappedMangas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
