import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseClient";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get("id");

    if (!chapterId) {
      return NextResponse.json({ error: "Missing chapter ID parameter 'id'" }, { status: 400 });
    }

    // 1. Fetch chapter details with pages and manga_id
    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("pages, manga_id")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapter) {
      console.warn(`⚠️ Chapter not found for ID ${chapterId}:`, chapterError?.message);
      return NextResponse.json({ error: "ไม่พบข้อมูลหน้าของตอนที่ระบุ" }, { status: 404 });
    }

    // 2. Fetch manga details to check is_mature
    const { data: manga, error: mangaError } = await supabaseAdmin
      .from("manga")
      .select("is_mature")
      .eq("id", chapter.manga_id)
      .single();

    if (mangaError || !manga) {
      console.warn(`⚠️ Manga not found for chapter's manga_id ${chapter.manga_id}:`, mangaError?.message);
      return NextResponse.json({ error: "ไม่พบข้อมูลมังงะสำหรับตอนที่ระบุ" }, { status: 404 });
    }

    // 3. If mature, verify authorization and age
    if (manga.is_mature) {
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
      let isAdult = false;

      if (token) {
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (user) {
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

      if (!isAdult) {
        return NextResponse.json(
          { error: "เนื้อหานี้จำกัดอายุเฉพาะผู้ใหญ่ (18+) กรุณาเข้าสู่ระบบและยืนยันอายุเพื่อเข้าอ่าน" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ pages: chapter.pages });
  } catch (err: unknown) {
    console.error("❌ Failed to fetch chapter pages:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
