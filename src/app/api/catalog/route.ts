import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseClient";
const { cleanGenres } = require("../../../lib/genreUtils");

// Global in-memory cache
let cachedCatalog: any = null;
let cacheExpiryTime: number = 0;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

export function clearCatalogCache() {
  cachedCatalog = null;
  cacheExpiryTime = 0;
  console.log("⚡ [Catalog Cache] Invalidation triggered.");
}

export async function GET(request: NextRequest) {
  try {
    // 0. Verify if the user is authenticated and age-verified (18+)
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    let isAdult = false;

    if (token) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        // Check if user is admin (admins can always view mature content)
        const isAdmin = user.app_metadata?.role === "admin";
        if (isAdmin) {
          isAdult = true;
        } else {
          // Fetch profile to verify age
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("birth_date, birth_year")
            .eq("id", user.id)
            .single();

          if (profile) {
            let userAge = null;
            if (profile.birth_date) {
              const today = new Date();
              const birthDate = new Date(profile.birth_date);
              if (!isNaN(birthDate.getTime())) {
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                  age--;
                }
                userAge = age;
              }
            } else if (profile.birth_year) {
              userAge = new Date().getFullYear() - profile.birth_year;
            }
            isAdult = userAge !== null && userAge >= 18;
          }
        }
      }
    }

    const now = Date.now();
    let mangas = cachedCatalog;

    if (!mangas || now >= cacheExpiryTime) {
      console.log("⚡ [Catalog Cache] Cache miss. Querying database...");

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

      // 2. Fetch all chapters using pagination to bypass 1000 row limit
      let chaptersData: any[] = [];
      let fetchMoreChapters = true;
      let chapterOffset = 0;
      const CHAPTER_PAGE_SIZE = 1000;

      while (fetchMoreChapters) {
        const { data: pageData, error: chaptersError } = await supabaseAdmin
          .from("chapters")
          .select("id, manga_id, title, release_date, created_at")
          .order("created_at", { ascending: true })
          .range(chapterOffset, chapterOffset + CHAPTER_PAGE_SIZE - 1);

        if (chaptersError) {
          console.warn("⚠️ Failed to fetch chapters from DB:", chaptersError.message);
          fetchMoreChapters = false;
          break;
        }

        if (pageData && pageData.length > 0) {
          chaptersData = [...chaptersData, ...pageData];
          chapterOffset += CHAPTER_PAGE_SIZE;
          if (pageData.length < CHAPTER_PAGE_SIZE) {
            fetchMoreChapters = false;
          }
        } else {
          fetchMoreChapters = false;
        }
        
        // Safety break to prevent infinite loop
        if (chapterOffset > 50000) break;
      }

      // 3. Fetch activity logs to aggregate views and bookmarks from history
      const { data: logsData, error: logsError } = await supabaseAdmin
        .from("activity_logs")
        .select("user_id, event_type, metadata")
        .in("event_type", ["chapter_read", "bookmark_toggle"])
        .order("created_at", { ascending: true });

      if (logsError) {
        console.warn("⚠️ Failed to fetch activity logs from DB:", logsError.message);
      }

      const bookmarkCounts: Record<string, number> = {};
      const progressUsers: Record<string, Set<string>> = {};

      if (logsData) {
        // Track bookmark status for each user and manga: user_id -> manga_id -> isBookmarked (boolean)
        const userBookmarks: Record<string, Record<string, boolean>> = {};

        logsData.forEach((log: any) => {
          const mangaId = log.metadata?.manga_id;
          if (!mangaId) return;

          if (log.event_type === "chapter_read") {
            if (log.user_id) {
              if (!progressUsers[mangaId]) {
                progressUsers[mangaId] = new Set();
              }
              progressUsers[mangaId].add(log.user_id);
            }
          } else if (log.event_type === "bookmark_toggle") {
            const action = log.metadata?.action; // "add" or "remove"
            if (log.user_id) {
              if (!userBookmarks[log.user_id]) {
                userBookmarks[log.user_id] = {};
              }
              userBookmarks[log.user_id][mangaId] = (action === "add");
            }
          }
        });

        // Compute active bookmark counts
        Object.keys(userBookmarks).forEach(uid => {
          const mangas = userBookmarks[uid];
          Object.keys(mangas).forEach(mid => {
            if (mangas[mid]) {
              bookmarkCounts[mid] = (bookmarkCounts[mid] || 0) + 1;
            }
          });
        });
      }

      // 5. Map database rows to the client-side Manga interface
      const mappedMangas = mangasData.map((m: any) => {
        const mangaChapters = (chaptersData || [])
          .filter((ch: any) => ch.manga_id === m.id)
          .map((ch: any) => ({
            id: ch.id,
            title: ch.title,
            release_date: ch.release_date,
            pages: [], // Do not fetch pages here; they are loaded on-demand during reading
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
          is_mature: m.is_mature,
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

      // Save to cache
      cachedCatalog = mappedMangas;
      cacheExpiryTime = Date.now() + CACHE_DURATION;
      mangas = mappedMangas;
    }

    // Filter mature content if the user is not logged in or under 18
    const filteredMangas = isAdult 
      ? mangas 
      : mangas.filter((m: any) => !m.is_mature);

    return NextResponse.json({ mangas: filteredMangas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
