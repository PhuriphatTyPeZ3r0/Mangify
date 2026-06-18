import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseClient";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get("id");

    if (!chapterId) {
      return NextResponse.json({ error: "Missing chapter ID parameter 'id'" }, { status: 400 });
    }

    // Fetch only the 'pages' column for the requested chapter using the standardized ID
    const { data, error } = await supabaseAdmin
      .from("chapters")
      .select("pages")
      .eq("id", chapterId)
      .single();

    if (error || !data) {
      console.warn(`⚠️ Chapter pages not found for ID ${chapterId}:`, error?.message);
      return NextResponse.json({ error: "ไม่พบข้อมูลหน้าของตอนที่ระบุ" }, { status: 404 });
    }

    return NextResponse.json({ pages: data.pages });
  } catch (err: unknown) {
    console.error("❌ Failed to fetch chapter pages:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
