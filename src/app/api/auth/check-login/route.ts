import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { send2FACodeEmail } from "../../../../lib/mail";

// Create a temporary Supabase client for password validation without service role privilege
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // Initialize temporary supabase client to check password credentials safely
    const tempSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { auth: { persistSession: false } }
    );

    // Validate email/password
    const { data: authData, error: authError } = await tempSupabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 400 });
    }

    const userId = authData.user.id;

    // Check if 2FA is enabled in user profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("two_factor_enabled")
      .eq("id", userId)
      .single();

    const twoFactorEnabled = profile ? !!profile.two_factor_enabled : false;

    if (!twoFactorEnabled) {
      // 2FA is disabled, tell client to proceed with normal Supabase login
      return NextResponse.json({ requires2FA: false });
    }

    // 2FA is enabled: Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes expiry

    // Save the 2FA code and expiry to profiles table
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        two_factor_code: code,
        two_factor_expires_at: expiresAt
      })
      .eq("id", userId);

    if (updateError) {
      console.error("❌ Failed to update 2FA code during login check:", updateError.message);
      return NextResponse.json({ error: "Failed to initialize 2FA verification." }, { status: 500 });
    }

    // Send email using Gmail SMTP
    const emailResult = await send2FACodeEmail(email, code);

    if (!emailResult.success) {
      return NextResponse.json({ error: `ไม่สามารถส่งรหัส 2FA ได้: ${emailResult.error}` }, { status: 500 });
    }

    return NextResponse.json({
      requires2FA: true,
      userId
    });
  } catch (err: any) {
    console.error("❌ check-login exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
