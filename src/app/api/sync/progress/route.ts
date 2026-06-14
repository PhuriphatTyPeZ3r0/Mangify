import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseClient";

// 1. GET: Fetch reading progress for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const mangaId = searchParams.get("mangaId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    let query;

    if (token) {
      const userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: { headers: { Authorization: `Bearer ${token}` } }
        }
      );
      query = userSupabase.from("reading_progress").select("*").eq("user_id", userId);
    } else {
      if (!userId.startsWith("anon-")) {
        return NextResponse.json({ error: "Invalid user ID format" }, { status: 401 });
      }
      query = supabaseAdmin.from("reading_progress").select("*").eq("user_id", userId);
    }

    if (mangaId) {
      query = query.eq("manga_id", mangaId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ progress: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Add or update reading progress
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, mangaId, chapterId, pageIndex, scrollPercent } = body;

    if (!userId || !mangaId || !chapterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user is authenticated via Authorization header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (token) {
      // Create user-scoped client that respects RLS policies
      const userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: { headers: { Authorization: `Bearer ${token}` } }
        }
      );

      const { error } = await userSupabase
        .from("reading_progress")
        .upsert({
          user_id: userId,
          manga_id: mangaId,
          chapter_id: chapterId,
          page_index: pageIndex,
          scroll_percent: scrollPercent,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,manga_id" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Anonymous User Flow
      // Validate that anonymous user ID starts with "anon-" to prevent unauthorized writing to authenticated IDs
      if (!userId.startsWith("anon-")) {
        return NextResponse.json({ error: "Invalid user ID format for anonymous request" }, { status: 401 });
      }

      const { error } = await supabaseAdmin
        .from("reading_progress")
        .upsert({
          user_id: userId,
          manga_id: mangaId,
          chapter_id: chapterId,
          page_index: pageIndex,
          scroll_percent: scrollPercent,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,manga_id" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
