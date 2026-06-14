import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

export async function GET() {
  try {
    // 1. Fetch all manga records from Supabase
    const { data: mangasData, error: mangaError } = await supabase
      .from("manga")
      .select("*")
      .order("created_at", { ascending: false });

    if (mangaError) {
      // If table does not exist or Supabase variables are placeholder, fallback to empty array
      console.warn("⚠️ Failed to fetch manga catalog from DB:", mangaError.message);
      return NextResponse.json({ mangas: [] });
    }

    if (!mangasData || mangasData.length === 0) {
      return NextResponse.json({ mangas: [] });
    }

    // 2. Fetch all chapters
    const { data: chaptersData, error: chaptersError } = await supabase
      .from("chapters")
      .select("*")
      .order("created_at", { ascending: true });

    if (chaptersError) {
      console.warn("⚠️ Failed to fetch chapters from DB:", chaptersError.message);
      return NextResponse.json({ mangas: [] });
    }

    // 3. Map database rows to the client-side Manga interface
    const mappedMangas = mangasData.map((m: any) => {
      const mangaChapters = (chaptersData || [])
        .filter((ch: any) => ch.manga_id === m.id)
        .map((ch: any) => ({
          id: ch.id,
          title: ch.title,
          pages: ch.pages
        }));

      // Naturally sort chapters if their IDs or titles have numerical values
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
      mangaChapters.sort((a: any, b: any) => collator.compare(a.title, b.title));

      return {
        id: m.id,
        title: m.title,
        author: m.author || "Unknown",
        cover: m.cover || "",
        description: m.description || "",
        genres: m.genres || [],
        popularity: m.popularity || 0,
        isOriginal: m.is_original,
        chapters: mangaChapters
      };
    });

    return NextResponse.json({ mangas: mappedMangas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
