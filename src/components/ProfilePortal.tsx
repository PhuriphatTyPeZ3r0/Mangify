import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { OtpInput } from "./OtpInput";

interface ProfilePortalProps {
  userId: string;
  userEmail: string;
  onLogout: () => void;
  onProfileUpdate?: () => void;
}

export const ProfilePortal: React.FC<ProfilePortalProps> = ({
  userId,
  userEmail,
  onLogout,
  onProfileUpdate
}) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [birthDate, setBirthDate] = useState<string>("");
  
  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  
  // 2FA Verification Overlay Modal State
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [pending2FAToggleValue, setPending2FAToggleValue] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // File Input Ref for Uploading
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile from Supabase
  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("⚠️ Profile not found, creating default profile row.");
        // Try creating row if not exists (fail-safe fallback)
        await supabase.from("profiles").insert({ id: userId });
      } else if (data) {
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setSelectedAvatar(data.avatar_url || "");
        setTwoFactorEnabled(!!data.two_factor_enabled);
        setBirthDate(data.birth_date || "");
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  // Handle Profile Update (CRUD - Update)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          username: username,
          avatar_url: selectedAvatar,
          birth_date: birthDate || null,
          birth_year: birthDate ? new Date(birthDate).getFullYear() : null,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (error) throw error;
      setMessage({ text: "บันทึกข้อมูลโปรไฟล์ของคุณเรียบร้อยแล้ว!", type: "success" });
      if (onProfileUpdate) onProfileUpdate();
    } catch (err: any) {
      setMessage({ text: `เกิดข้อผิดพลาด: ${err.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Handle File Upload and Resizing to 200x200 WebP/JPEG Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Force a 200x200 square image
        canvas.width = 200;
        canvas.height = 200;

        // Crop center of the image to keep correct aspect ratio
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;

        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);

        // Convert to WebP base64 format (fallback to JPEG if not supported by canvas)
        let dataUrl = canvas.toDataURL("image/webp", 0.85);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }

        setSelectedAvatar(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Remove selected avatar image
  const handleRemoveAvatar = () => {
    setSelectedAvatar("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Trigger 2FA Toggle (Needs email verification code first)
  const handle2FAToggleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setPending2FAToggleValue(checked);
    setVerificationCode("");
    setVerificationError(null);
    setIsVerifying2FA(true);

    try {
      // Call Next.js API to generate and send verification code via Gmail SMTP
      const res = await fetch("/api/auth/send-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send verification code.");
    } catch (err: any) {
      setIsVerifying2FA(false);
      alert(`ไม่สามารถส่งอีเมลรหัสยืนยันได้: ${err.message}`);
    }
  };

  // Verify Code and Update 2FA Setting in DB
  const handleVerify2FACode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setVerifyingCode(true);
    setVerificationError(null);

    try {
      // Call Next.js API to verify the code
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: verificationCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "รหัสยืนยันไม่ถูกต้อง");

      // Update 2FA status in Database profiles table
      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          two_factor_enabled: pending2FAToggleValue,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (dbError) throw dbError;

      setTwoFactorEnabled(pending2FAToggleValue);
      setIsVerifying2FA(false);
      alert(pending2FAToggleValue ? "เปิดใช้งานระบบความปลอดภัย 2FA สำเร็จ!" : "ปิดใช้งานระบบความปลอดภัย 2FA สำเร็จ!");
    } catch (err: any) {
      setVerificationError(err.message);
    } finally {
      setVerifyingCode(false);
    }
  };

  // Auto-submit 2FA setup verification code when all 6 digits are filled
  useEffect(() => {
    if (verificationCode.length === 6 && isVerifying2FA) {
      handleVerify2FACode();
    }
  }, [verificationCode, isVerifying2FA]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="material-symbols-outlined text-[48px] animate-spin text-accent mb-4">cached</span>
        <p className="prompt-medium text-lg opacity-70">กำลังดึงข้อมูลบัญชีของคุณ...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto pb-12">
      {/* Hidden File Input for uploading avatar */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Card: Account Card with upload button */}
        <div className="w-full lg:w-1/3 bg-surface border border-border/80 rounded-3xl p-6 flex flex-col items-center text-center shadow-sm">
          {/* Avatar frame */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-full overflow-hidden border-2 border-accent/20 shadow-md mb-3 relative bg-background flex items-center justify-center group cursor-pointer hover:border-accent hover:scale-105 transition-all duration-300"
            title="คลิกเพื่ออัปโหลดรูปภาพโปรไฟล์ใหม่"
          >
            {selectedAvatar ? (
              <img 
                src={selectedAvatar} 
                alt="Profile Avatar" 
                referrerPolicy="no-referrer" 
                className="w-full h-full object-cover group-hover:opacity-75 transition-opacity duration-300" 
              />
            ) : (
              <div className="w-full h-full bg-accent/10 flex items-center justify-center text-accent prompt-bold text-2xl group-hover:opacity-75 transition-opacity duration-300">
                {displayName ? displayName.charAt(0).toUpperCase() : (username ? username.charAt(0).toUpperCase() : "?")}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-300">
              <span className="material-symbols-outlined text-[20px]">upload</span>
            </div>
          </div>

          {/* Remove Avatar Button */}
          {selectedAvatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="text-[10px] prompt-medium text-destructive hover:underline mb-4 flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[12px]">delete</span>
              ลบรูปภาพโปรไฟล์
            </button>
          )}
          
          <h3 className="prompt-bold text-lg text-foreground truncate max-w-[200px] mt-1">
            {displayName || "ไม่มีชื่อแสดงผล"}
          </h3>
          <p className="prompt-light text-xs opacity-60 mt-0.5">{userEmail}</p>
          <span className="mt-3 px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] prompt-medium">
            @{username || "no_username"}
          </span>
        </div>

        {/* Right Card: Settings form */}
        <div className="flex-1 w-full bg-surface border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h2 className="prompt-bold text-xl mb-6 flex items-center gap-2 border-b border-border/50 pb-4">
            <span className="material-symbols-outlined text-accent text-[24px]">manage_accounts</span>
            ข้อมูลผู้ใช้งาน
          </h2>

          {message && (
            <div className={`p-4 rounded-2xl mb-6 text-xs prompt-medium flex items-center gap-2 border ${
              message.type === "success" 
                ? "bg-green-500/10 border-green-500/20 text-green-600" 
                : "bg-red-500/10 border-red-500/20 text-red-500"
            }`}>
              <span className="material-symbols-outlined text-[16px]">
                {message.type === "success" ? "check_circle" : "error"}
              </span>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80">ชื่อที่ต้องการแสดง (Display Name)</label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น สมชาย นามสมมุติ"
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80">ชื่อผู้ใช้งาน (Username)</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-sm prompt-medium opacity-40">@</span>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    pattern="^[a-zA-Z0-9_]+$"
                    title="ภาษาอังกฤษ ตัวเลข และขีดล่างเท่านั้น"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="somchai_cool"
                    className="w-full text-sm prompt-regular pl-8 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              {/* Birth Date */}
              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80">วัน/เดือน/ปีเกิด (Date of Birth)</label>
                <input
                  type="date"
                  value={birthDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors text-foreground"
                />
              </div>

              {/* Email (Disabled) */}
              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-40">ที่อยู่อีเมล (ไม่สามารถเปลี่ยนได้)</label>
                <input
                  type="email"
                  disabled
                  value={userEmail}
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background opacity-50 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 border-t border-border/50 pt-6 mt-8">
              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto justify-center px-4 sm:px-5 py-2.5 rounded-xl text-xs prompt-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                ออกจากระบบสมาชิก
              </button>
              
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto justify-center px-4 sm:px-6 py-2.5 rounded-xl text-xs prompt-bold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-accent/20"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">cached</span>
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    บันทึกโปรไฟล์
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* 2FA Verification Overlay Modal */}
      {isVerifying2FA && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsVerifying2FA(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer text-foreground flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="text-center mb-6">
              <span className="material-symbols-outlined text-accent text-[48px] mb-2 fill">mark_email_read</span>
              <h3 className="prompt-bold text-lg">ยืนยันการตั้งค่า 2FA</h3>
              <p className="prompt-light text-xs opacity-60 mt-1.5 px-4">
                เราได้ส่งรหัสยืนยัน 6 หลัก ไปที่อีเมล <strong>{userEmail}</strong> เรียบร้อยแล้ว กรุณาใส่รหัสนั้นด้านล่างนี้เพื่อยืนยันความเป็นเจ้าของบัญชี
              </p>
            </div>

            <form onSubmit={handleVerify2FACode} className="space-y-4">
              <div className="space-y-1.5">
                <OtpInput 
                  value={verificationCode}
                  onChange={setVerificationCode}
                  disabled={verifyingCode}
                />
              </div>

              {verificationError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-xs prompt-regular">
                  {verificationError}
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingCode || verificationCode.length !== 6}
                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"
              >
                {verifyingCode ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">cached</span>
                    กำลังยืนยัน...
                  </>
                ) : (
                  "ยืนยันตัวตน"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
