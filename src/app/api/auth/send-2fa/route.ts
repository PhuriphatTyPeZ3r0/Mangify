import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { send2FACodeEmail } from "../../../../lib/mail";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    // Generate a 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes expiry

    // Save the 2FA code and expiry to the user's profile
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        two_factor_code: code,
        two_factor_expires_at: expiresAt
      })
      .eq("id", userId);

    if (updateError) {
      console.error("❌ Failed to update 2FA code in DB:", updateError.message);
      return NextResponse.json({ error: "Failed to generate 2FA session in database." }, { status: 500 });
    }

    // Send 2FA email using Resend
    const emailResult = await send2FACodeEmail(email, code);

    if (!emailResult.success) {
      return NextResponse.json({ error: emailResult.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "2FA code sent successfully." });
  } catch (err: any) {
    console.error("❌ 2FA send exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
