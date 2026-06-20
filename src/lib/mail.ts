import nodemailer from "nodemailer";
import { Resend } from "resend";

const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

// Create transporter using Gmail SMTP service (for local testing fallback)
const transporter = smtpUser && smtpPassword
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPassword, // Gmail App Password (16 characters)
      },
    })
  : null;

// Initialize Resend Client (for Production on Vercel)
const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Sends a 2FA verification code to the user's email address.
 * It attempts to send via Resend API first (Production).
 * If Resend API is not configured, it falls back to Gmail SMTP (Local/Dev).
 * If neither is configured, it prints the code directly to the server terminal.
 */
export const send2FACodeEmail = async (toEmail: string, code: string) => {
  const mailSubject = `🛡️ รหัสยืนยัน 2FA สำหรับเข้าสู่ระบบ Mangify: ${code}`;
  const mailHtml = `
    <div style="font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 500px; margin: auto; border: 1px solid #e6dfd5; border-radius: 24px; background-color: #faf8f5;">
      
      <!-- Logo / Header -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 26px; font-weight: 800; color: #d35400; letter-spacing: -0.5px; margin-bottom: 2px;">MANGIFY</div>
        <div style="font-size: 10px; font-weight: 600; color: #a08c75; letter-spacing: 2px; text-transform: uppercase;">Security Center</div>
      </div>
      
      <!-- Main Content Card -->
      <div style="background-color: #f3efe9; border-radius: 20px; border: 1px solid #e6dfd5; padding: 30px; text-align: center; margin-bottom: 25px;">
        <div style="display: inline-block; padding: 12px; background-color: rgba(211, 84, 0, 0.08); border-radius: 16px; margin-bottom: 16px;">
          <span style="font-size: 28px; line-height: 1;">🛡️</span>
        </div>
        
        <h3 style="font-size: 16px; font-weight: 700; color: #2b2621; margin: 0 0 8px 0;">การยืนยันตัวตนแบบสองขั้นตอน (2FA)</h3>
        <p style="font-size: 12px; color: #5a524a; line-height: 1.6; margin: 0 0 20px 0; padding: 0 10px;">
          ระบบตรวจพบความพยายามในการเข้าสู่ระบบด้วยบัญชีของคุณ โปรดกรอกรหัสยืนยัน 6 หลักต่อไปนี้เพื่อลงชื่อเข้าใช้งานอย่างปลอดภัย
        </p>
        
        <!-- 2FA Code Badge -->
        <div style="font-size: 36px; font-weight: 800; color: #d35400; letter-spacing: 6px; padding: 12px 24px; background-color: #faf8f5; border-radius: 14px; border: 1px solid #e6dfd5; display: inline-block; min-width: 160px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.01);">
          ${code}
        </div>
        
        <p style="font-size: 11px; color: #d35400; font-weight: 600; margin: 16px 0 0 0;">
          ⏳ รหัสนี้จะหมดอายุการใช้งานภายใน 5 นาที
        </p>
      </div>
      
      <!-- Security Tip / Warning -->
      <div style="padding: 0 10px;">
        <p style="font-size: 10px; color: #8a7e72; line-height: 1.5; margin: 0 0 16px 0;">
          <strong>⚠️ ข้อควรระวัง:</strong> ห้ามส่งต่อรหัสยืนยันนี้ให้แก่บุคคลอื่นโดยเด็ดขาด เจ้าหน้าที่ของ Mangify จะไม่ขอรหัสผ่านหรือรหัส 2FA ของคุณไม่ว่าในกรณีใดๆ
        </p>
        
        <hr style="border: 0; border-top: 1px solid #e6dfd5; margin: 16px 0;" />
        
        <p style="font-size: 10px; color: #a09080; text-align: center; margin: 0; line-height: 1.4;">
          หากคุณไม่ได้ขอดำเนินการเข้าสู่ระบบ โปรดเพิกเฉยต่ออีเมลฉบับนี้และแนะนำให้เปลี่ยนรหัสผ่านทันที<br />
          © 2026 Mangify. All rights reserved.
        </p>
      </div>
      
    </div>
  `;

  // 1. Try sending via Resend API (Recommended for Cloud Production)
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: `Mangify Security <${resendFromEmail}>`,
        to: toEmail,
        subject: mailSubject,
        html: mailHtml,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`📧 2FA code email successfully sent to ${toEmail} via Resend API`);
      return { success: true };
    } catch (err: any) {
      console.warn("⚠️ Failed to send 2FA email via Resend, trying SMTP fallback...", err.message || err);
      // Let it fall through to Nodemailer SMTP transporter if available
    }
  }

  // 2. Fallback: Try sending via Nodemailer (Gmail SMTP)
  if (transporter && smtpUser) {
    try {
      const mailOptions = {
        from: `"Mangify Security" <${smtpUser}>`,
        to: toEmail,
        subject: mailSubject,
        html: mailHtml,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 2FA code email successfully sent to ${toEmail} via Gmail SMTP`);
      return { success: true };
    } catch (err: any) {
      console.error("❌ Failed to send 2FA email via Gmail SMTP:", err);
      return { success: false, error: err.message || "Failed to send email." };
    }
  }

  // 3. Fallback: Log directly to terminal (Local Dev fallback)
  console.log("\n-----------------------------------------");
  console.log(`🔑 [DEVELOPMENT 2FA CODE FALLBACK]`);
  console.log(`To: ${toEmail}`);
  console.log(`Code: ${code}`);
  console.log("-----------------------------------------");
  console.log("📢 TIP: To send real emails, configure RESEND_API_KEY or SMTP variables in your environment.\n");
  
  return { 
    success: true, 
    warning: "Email services not configured. Code logged to server console." 
  };
};
