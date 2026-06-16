import nodemailer from "nodemailer";

const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

// Create transporter using Gmail SMTP service
const transporter = smtpUser && smtpPassword
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPassword, // Gmail App Password (16 characters)
      },
    })
  : null;

/**
 * Sends a 2FA verification code to the user's email address using Gmail SMTP (Nodemailer).
 * If SMTP keys are missing, it logs the code to the terminal console as a fallback.
 */
export const send2FACodeEmail = async (toEmail: string, code: string) => {
  if (!transporter) {
    console.log("\n-----------------------------------------");
    console.log(`🔑 [DEVELOPMENT 2FA CODE FALLBACK]`);
    console.log(`To: ${toEmail}`);
    console.log(`Code: ${code}`);
    console.log("-----------------------------------------");
    console.log("📢 TIP: To send real emails, add SMTP_USER and SMTP_PASSWORD to your .env.local file.\n");
    
    // Return success to client so local development/testing is not blocked
    return { 
      success: true, 
      warning: "SMTP_USER or SMTP_PASSWORD is not configured. Code logged to server console." 
    };
  }

  try {
    const mailOptions = {
      from: `"Mangify Security" <${smtpUser}>`,
      to: toEmail,
      subject: `🛡️ รหัสยืนยัน 2FA สำหรับเข้าสู่ระบบ Mangify: ${code}`,
      html: `
        <div style="font-family: 'Prompt', sans-serif; padding: 30px; max-width: 550px; margin: auto; border: 1px solid #e6dfd5; border-radius: 16px; background-color: #faf8f5;">
          <h2 style="color: #d35400; text-align: center; margin-bottom: 24px; font-weight: 700;">ระบบความปลอดภัย Mangify</h2>
          <p style="font-size: 14px; color: #2b2621; line-height: 1.6;">ระบบตรวจพบว่าคุณกำลังเข้าสู่ระบบ Mangify บัญชีของคุณได้รับการเปิดใช้งานการยืนยันตัวตนแบบสองขั้นตอน (2FA)</p>
          <p style="font-size: 14px; color: #2b2621; line-height: 1.6;">โปรดใช้รหัสยืนยันด้านล่างนี้เพื่อทำการลงชื่อเข้าใช้งาน:</p>
          
          <div style="font-size: 36px; font-weight: 800; color: #d35400; text-align: center; letter-spacing: 6px; margin: 30px 0; padding: 15px; background-color: #f3efe9; border-radius: 12px; border: 1px solid #e6dfd5; max-width: 200px; margin-left: auto; margin-right: auto;">
            ${code}
          </div>
          
          <p style="font-size: 11px; color: #d35400; background-color: #faf8f5; text-align: center; font-weight: 500; margin-top: 10px;">
            ⚠️ รหัสผ่านนี้จะหมดอายุภายใน 5 นาที
          </p>
          <hr style="border: 0; border-top: 1px solid #e6dfd5; margin: 24px 0;" />
          <p style="font-size: 11px; color: #888; line-height: 1.4;">หากคุณไม่ได้ขอดำเนินการนี้ โปรดเปลี่ยนรหัสผ่านบัญชีผู้ใช้ของคุณทันทีเพื่อความปลอดภัยของข้อมูล</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 2FA code email successfully sent to ${toEmail}`);
    return { success: true };
  } catch (err: any) {
    console.error("❌ Failed to send 2FA email via Gmail SMTP:", err);
    return { success: false, error: err.message || "Failed to send email." };
  }
};
