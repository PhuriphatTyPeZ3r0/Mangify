import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Manga } from "../types";

interface ProfilePortalProps {
  userId: string;
  userEmail: string;
  onLogout: () => void;
  mangas?: Manga[];
}

interface AnimeAvatarProps {
  cover: string;
  title: string;
  onClick: (croppedUrl: string) => void;
  isActive: boolean;
}

export const AnimeAvatar: React.FC<AnimeAvatarProps> = ({ cover, title, onClick, isActive }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [croppedUrl, setCroppedUrl] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = cover;
    
    img.onload = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 150;
      canvas.height = 150;

      // Analyze skin color dynamically for face detection fallback
      const offCanvas = document.createElement("canvas");
      const offCtx = offCanvas.getContext("2d");
      if (offCtx) {
        const scale = 200 / img.width;
        offCanvas.width = 200;
        offCanvas.height = img.height * scale;
        offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);

        try {
          const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
          const data = imgData.data;

          // Search in the middle section of the cover (typical face area, avoiding logo/texts)
          const yStart = Math.floor(offCanvas.height * 0.20);
          const yEnd = Math.floor(offCanvas.height * 0.65);

          let totalX = 0;
          let totalY = 0;
          let count = 0;

          for (let y = yStart; y < yEnd; y += 3) {
            for (let x = 0; x < offCanvas.width; x += 3) {
              const idx = (y * offCanvas.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              // Skin detection: Peach / Warm anime colors
              const isSkin = r > 215 && g > 165 && b > 130 && r > g && g > b && (r - b) < 95;
              if (isSkin) {
                totalX += x;
                totalY += y;
                count++;
              }
            }
          }

          let targetX = img.width / 2;
          let targetY = img.height * 0.38; // Default focus (slightly lower to avoid header title)

          if (count > 30) {
            targetX = (totalX / count) / scale;
            targetY = (totalY / count) / scale;
          }

          const cropSize = Math.min(img.width, img.height) * 0.33; // Tighter crop focusing strictly on the face
          const sourceX = Math.max(0, Math.min(img.width - cropSize, targetX - cropSize / 2));
          const sourceY = Math.max(0, Math.min(img.height - cropSize, targetY - cropSize / 2));

          ctx.drawImage(img, sourceX, sourceY, cropSize, cropSize, 0, 0, 150, 150);
          
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          setCroppedUrl(dataUrl);
        } catch (e) {
          // If security block (CORS) or error, draw standard tighter center crop (avoid top text)
          const cropSize = Math.min(img.width, img.height) * 0.33;
          const sourceX = (img.width - cropSize) / 2;
          const sourceY = img.height * 0.25;
          ctx.drawImage(img, sourceX, sourceY, cropSize, cropSize, 0, 0, 150, 150);
          
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            setCroppedUrl(dataUrl);
          } catch (err) {
            // fallback to original cover url
            setCroppedUrl(cover);
          }
        }
      } else {
        setCroppedUrl(cover);
      }
      setLoading(false);
    };

    img.onerror = () => {
      if (active) {
        setCroppedUrl(cover);
        setLoading(false);
      }
    };

    return () => {
      active = false;
    };
  }, [cover]);

  return (
    <button
      type="button"
      onClick={() => onClick(croppedUrl || cover)}
      className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all relative group cursor-pointer ${
        isActive 
          ? "border-accent ring-4 ring-accent/20 scale-[1.03]" 
          : "border-border/60 hover:border-accent/50 hover:scale-[1.02]"
      }`}
      title={title}
    >
      <canvas ref={canvasRef} className="hidden" />
      {loading ? (
        <div className="w-full h-full skeleton animate-pulse" />
      ) : (
        <img 
          src={croppedUrl || cover} 
          alt={title} 
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" 
        />
      )}
      {isActive && (
        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center text-white backdrop-blur-[1px]">
          <span className="material-symbols-outlined text-[24px] fill drop-shadow-md">check_circle</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-left">
        <p className="text-[10px] text-white font-medium truncate prompt-regular">{title}</p>
      </div>
    </button>
  );
};

export const ProfilePortal: React.FC<ProfilePortalProps> = ({
  userId,
  userEmail,
  onLogout,
  mangas = []
}) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  
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
        setSelectedAvatar(data.avatar_url || "");
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
          <div 
            onClick={() => setIsAvatarModalOpen(true)}
            className="w-24 h-24 rounded-full overflow-hidden border-2 border-accent/20 shadow-md mb-4 relative bg-background flex items-center justify-center group cursor-pointer hover:border-accent hover:scale-105 transition-all duration-300"
            title="คลิกเพื่อเปลี่ยนรูปภาพโปรไฟล์"
          >
            {selectedAvatar ? (
              <img src={selectedAvatar} alt="Profile Avatar" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity duration-300" />
            ) : (
              <div className="w-full h-full bg-accent/10 flex items-center justify-center text-accent prompt-bold text-2xl group-hover:opacity-75 transition-opacity duration-300">
                {displayName ? displayName.charAt(0).toUpperCase() : (username ? username.charAt(0).toUpperCase() : "?")}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-300">
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </div>
          </div>
          
          <h3 className="prompt-bold text-lg text-foreground truncate max-w-[200px]">
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

      {/* Avatar Catalog Selection Popup Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="w-full max-w-2xl bg-surface border border-border/80 rounded-3xl p-6 sm:p-8 shadow-xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border/50 pb-4 mb-6">
              <h3 className="prompt-bold text-lg text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-[24px]">face</span>
                เลือกรูปภาพโปรไฟล์ตัวละครหลัก
              </h3>
              <button 
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface border border-transparent hover:border-border cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin">
              {/* Manga Character Avatars Grid */}
              <div>
                <h4 className="prompt-semibold text-xs text-foreground/80 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-accent">menu_book</span>
                  รูปโปรไฟล์:
                </h4>
                {mangas.length === 0 ? (
                  <div className="text-center py-6 text-xs opacity-60">
                    ไม่พบข้อมูลมังงะในระบบขณะนี้
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {mangas.map((manga) => (
                      <AnimeAvatar
                        key={manga.id}
                        cover={manga.cover}
                        title={manga.title}
                        isActive={
                          selectedAvatar === manga.cover || 
                          (selectedAvatar.startsWith("data:") && selectedAvatar.includes(manga.title)) || 
                          (selectedAvatar.includes(manga.cover.split("/").pop() || "no-match"))
                        }
                        onClick={(croppedUrl) => {
                          setSelectedAvatar(croppedUrl);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border/50 pt-4 mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-5 py-2.5 bg-accent hover:opacity-90 text-white border border-transparent text-xs prompt-semibold rounded-full cursor-pointer transition-colors shadow-sm"
              >
                ยืนยันและเสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
