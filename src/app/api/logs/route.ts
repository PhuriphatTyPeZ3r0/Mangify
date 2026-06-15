import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabaseClient";

// POST: Save user activity logs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eventType, metadata = {} } = body;

    if (!userId || !eventType) {
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
        .from("activity_logs")
        .insert({
          user_id: userId,
          event_type: eventType,
          metadata,
          created_at: new Date().toISOString()
        });

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
        .from("activity_logs")
        .insert({
          user_id: userId,
          event_type: eventType,
          metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
