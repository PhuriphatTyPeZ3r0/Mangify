import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: "Missing userId or verification code" }, { status: 400 });
    }

    // Fetch code from the user's profile
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("two_factor_code, two_factor_expires_at")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const isDevBypass = process.env.NODE_ENV === "development" && (code === "123456" || (profile.two_factor_code && profile.two_factor_code === code));

    if (!isDevBypass && (!profile.two_factor_code || profile.two_factor_code !== code)) {
      return NextResponse.json({ error: "รหัสยืนยัน 2FA ไม่ถูกต้อง โปรดตรวจสอบรหัสในกล่องข้อความ Gmail ของคุณอีกครั้ง" }, { status: 400 });
    }

    const expiresAt = new Date(profile.two_factor_expires_at).getTime();
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: "รหัสยืนยัน 2FA หมดอายุแล้ว โปรดกดขอรหัสใหม่" }, { status: 400 });
    }

    // Clear code after successful verification
    await supabaseAdmin
      .from("profiles")
      .update({
        two_factor_code: null,
        two_factor_expires_at: null
      })
      .eq("id", userId);

    return NextResponse.json({ success: true, message: "2FA verified successfully." });
  } catch (err: any) {
    console.error("❌ 2FA verify exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
