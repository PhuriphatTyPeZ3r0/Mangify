import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface ProfilePortalProps {
  userId: string;
  userEmail: string;
  onLogout: () => void;
}

export const AVATAR_PRESETS = [
  { name: "Na Kang Lim", url: "https://www.up-manga.com/wp-content/uploads/2023/11/Webtoon-Character-Na-Kang-Lim.jpg" },
  { name: "Yoo Ah-rin", url: "https://www.up-manga.com/wp-content/uploads/2023/11/Webtoon-Character-Na-Kang-Lim-ep1-1.jpg" },
  { name: "Baek Eun-ha", url: "https://www.up-manga.com/wp-content/uploads/2023/11/Webtoon-Character-Na-Kang-Lim-ep1-2.jpg" },
  { name: "Robo Felix", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Felix" },
  { name: "Robo Aneka", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Aneka" },
  { name: "Robo Nala", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Nala" }
];

export const ProfilePortal: React.FC<ProfilePortalProps> = ({
  userId,
  userEmail,
  onLogout
}) => {
  // Profile details state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0].url);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
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
        setSelectedAvatar(data.avatar_url || AVATAR_PRESETS[0].url);
        setTwoFactorEnabled(!!data.two_factor_enabled);
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
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (error) throw error;
      setMessage({ text: "บันทึกข้อมูลโปรไฟล์ของคุณเรียบร้อยแล้ว!", type: "success" });
    } catch (err: any) {
      setMessage({ text: `เกิดข้อผิดพลาด: ${err.message}`, type: "error" });
    } finally {
      setSaving(false);
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
  const handleVerify2FACode = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Card: Account Card with presets */}
        <div className="w-full lg:w-1/3 bg-surface border border-border/80 rounded-3xl p-6 flex flex-col items-center text-center shadow-sm">
          {/* Avatar frame */}
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-accent/20 shadow-md mb-4 relative bg-background">
            <img src={selectedAvatar} alt="Profile Avatar" className="w-full h-full object-cover" />
          </div>
          
          <h3 className="prompt-bold text-lg text-foreground truncate max-w-[200px]">
            {displayName || "ไม่มีชื่อแสดงผล"}
          </h3>
          <p className="prompt-light text-xs opacity-60 mt-0.5">{userEmail}</p>
          <span className="mt-3 px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] prompt-medium">
            @{username || "no_username"}
          </span>

          <hr className="w-full border-border/50 my-6" />

          {/* Quick presets picker */}
          <div className="w-full">
            <h4 className="prompt-semibold text-xs text-foreground/80 mb-3 text-left">เลือกรูปภาพโปรไฟล์ของคุณ:</h4>
            <div className="grid grid-cols-3 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const isActive = selectedAvatar === preset.url;
                return (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedAvatar(preset.url)}
                    className={`aspect-square rounded-xl overflow-hidden border transition-all relative group cursor-pointer ${
                      isActive ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/40"
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    {isActive && (
                      <div className="absolute inset-0 bg-accent/25 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[16px] fill">check_circle</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Card: Settings form */}
        <div className="flex-1 w-full bg-surface border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h2 className="prompt-bold text-xl mb-6 flex items-center gap-2 border-b border-border/50 pb-4">
            <span className="material-symbols-outlined text-accent text-[24px]">manage_accounts</span>
            ตั้งค่าโปรไฟล์และบัญชีผู้ใช้งาน
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

            {/* Security Section (2FA Toggle) */}
            <div className="border-t border-border/50 pt-6 mt-6 space-y-4">
              <h3 className="prompt-bold text-sm text-foreground/90 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-accent">security</span>
                ระบบความปลอดภัยเพิ่มเติม
              </h3>
              
              <div className="flex items-center justify-between p-4 bg-background/50 border border-border/60 rounded-2xl">
                <div className="text-left pr-4">
                  <h4 className="prompt-semibold text-xs text-foreground">การยืนยันตัวตนแบบสองขั้นตอน (2FA)</h4>
                  <p className="prompt-light text-[11px] opacity-60 mt-0.5">
                    ส่งรหัสยืนยัน 6 หลักไปที่ Gmail ของคุณทุกครั้งเมื่อทำเข้าสู่ระบบใหม่ เพื่อความปลอดภัยของข้อมูลขั้นสูงสุด
                  </p>
                </div>
                {/* Custom Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={handle2FAToggleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-border/50 pt-6 mt-8">
              <button
                type="button"
                onClick={onLogout}
                className="px-5 py-2.5 rounded-xl text-xs prompt-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                ออกจากระบบสมาชิก
              </button>
              
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-xs prompt-bold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-accent/20"
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
                <input
                  type="text"
                  required
                  maxLength={6}
                  pattern="\d{6}"
                  title="รหัสตัวเลข 6 หลัก"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-center tracking-[10px] font-bold text-xl prompt-bold px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
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
