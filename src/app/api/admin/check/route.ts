import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json({ isAdmin: false });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ isAdmin: false });
    }

    // Check app_metadata
    let isAdmin = user.app_metadata?.role === "admin";

    // Also check environment variable for admin emails
    const adminEmailsEnv = process.env.ADMIN_EMAILS;
    if (!isAdmin && adminEmailsEnv && user.email) {
      const allowedEmails = adminEmailsEnv.split(",").map(e => e.trim().toLowerCase());
      isAdmin = allowedEmails.includes(user.email.toLowerCase());
    }

    return NextResponse.json({ isAdmin });
  } catch (err) {
    return NextResponse.json({ isAdmin: false });
  }
}
