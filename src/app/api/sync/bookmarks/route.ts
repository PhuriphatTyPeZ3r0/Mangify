import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseClient";

// 1. GET: Fetch all bookmarks for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    let data, error;

    if (token) {
      const userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: { headers: { Authorization: `Bearer ${token}` } }
        }
      );
      ({ data, error } = await userSupabase
        .from("bookmarks")
        .select("manga_id, created_at")
        .eq("user_id", userId));
    } else {
      if (!userId.startsWith("anon-")) {
        return NextResponse.json({ error: "Invalid user ID format" }, { status: 401 });
      }
      ({ data, error } = await supabaseAdmin
        .from("bookmarks")
        .select("manga_id, created_at")
        .eq("user_id", userId));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookmarks: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Add a bookmark
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, mangaId } = body;

    if (!userId || !mangaId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (token) {
      const userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: { headers: { Authorization: `Bearer ${token}` } }
        }
      );
      const { error } = await userSupabase
        .from("bookmarks")
        .insert({ user_id: userId, manga_id: mangaId });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      if (!userId.startsWith("anon-")) {
        return NextResponse.json({ error: "Invalid user ID format" }, { status: 401 });
      }
      const { error } = await supabaseAdmin
        .from("bookmarks")
        .insert({ user_id: userId, manga_id: mangaId });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 3. DELETE: Remove a bookmark
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const mangaId = searchParams.get("mangaId");

    if (!userId || !mangaId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (token) {
      const userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: { headers: { Authorization: `Bearer ${token}` } }
        }
      );
      const { error } = await userSupabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("manga_id", mangaId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      if (!userId.startsWith("anon-")) {
        return NextResponse.json({ error: "Invalid user ID format" }, { status: 401 });
      }
      const { error } = await supabaseAdmin
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("manga_id", mangaId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
