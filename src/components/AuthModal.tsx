import React from "react";

interface AuthModalProps {
  isOpen: boolean;
  mode: "login" | "signup" | "emailsent";
  onClose: () => void;
  onSetMode: (mode: "login" | "signup" | "emailsent") => void;
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  confirmPassword?: string;
  onConfirmPasswordChange?: (confirmPassword: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSetMode,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  confirmPassword = "",
  onConfirmPasswordChange,
  loading,
  error,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-foreground/5 transition-colors cursor-pointer text-foreground flex items-center justify-center"
          aria-label="Close auth modal"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {mode === "emailsent" ? (
          /* Check Inbox Screen (Success Register Flow) */
          <div className="text-center py-4 flex flex-col items-center">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mb-6 animate-bounce">
              <span className="material-symbols-outlined text-[36px] fill">mark_email_read</span>
            </div>
            
            <h3 className="prompt-bold text-xl mb-3">ตรวจสอบกล่องข้อความของคุณ</h3>
            
            <p className="prompt-light text-sm opacity-80 leading-relaxed px-2 mb-6">
              เราได้ส่งลิงก์ยืนยันตัวตนเพื่อเปิดใช้งานบัญชีสมาชิกไปที่ <br />
              <strong className="prompt-semibold text-accent break-all">{email}</strong> แล้ว
            </p>

            <div className="p-4 bg-background/50 border border-border/60 rounded-2xl text-left text-xs prompt-regular space-y-2 mb-8 w-full">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[14px] text-accent mt-0.5">info</span>
                <p className="opacity-80">โปรดคลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชีก่อนทำการเข้าสู่ระบบ</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[14px] text-accent mt-0.5">mail</span>
                <p className="opacity-85">หากหาไม่เจอ โปรดตรวจสอบในกล่องจดหมายขยะ (Spam/Junk mail)</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <button
                type="button"
                onClick={() => onSetMode("login")}
                className="w-full bg-accent hover:opacity-90 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                กลับไปยังหน้าเข้าสู่ระบบ
              </button>
              
              <button
                type="button"
                onClick={onClose}
                className="w-full border border-border hover:bg-foreground/5 text-foreground font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs prompt-semibold"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        ) : (
          /* Login & Signup Forms */
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="prompt-bold text-xl">
                {mode === "login" ? "เข้าสู่ระบบสมาชิก" : "สมัครสมาชิกใหม่"}
              </h3>
              <p className="prompt-light text-xs opacity-60 mt-1">
                {mode === "login" 
                  ? "เข้าสู่ระบบเพื่อสำรองข้อมูลบุ๊กมาร์กและอ่านต่อได้จากทุกอุปกรณ์" 
                  : "สร้างบัญชีใหม่เพื่อเชื่อมข้อมูลบุ๊กมาร์กและประวัติการอ่านของคุณ"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80">อีเมล (Email)</label>
                <input 
                  type="email"
                  required
                  placeholder="yourname@example.com"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80">รหัสผ่าน (Password)</label>
                <input 
                  type="password"
                  required
                  minLength={6}
                  placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Confirm Password (Signup only) */}
              {mode === "signup" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs prompt-semibold opacity-80">ยืนยันรหัสผ่าน (Confirm Password)</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    placeholder="ระบุรหัสผ่านให้ตรงกันอีกครั้ง"
                    value={confirmPassword}
                    onChange={(e) => onConfirmPasswordChange?.(e.target.value)}
                    className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-xs prompt-regular">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">cached</span>
                    กำลังดำเนินการ...
                  </>
                ) : (
                  <>
                    {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                  </>
                )}
              </button>
            </form>

            {/* Mode Toggle Switcher */}
            <div className="text-center mt-6 pt-4 border-t border-border/60">
              <p className="prompt-light text-xs opacity-75">
                {mode === "login" ? "ยังไม่มีบัญชีสมาชิก?" : "มีบัญชีสมาชิกอยู่แล้ว?"}
                <button
                  type="button"
                  onClick={() => {
                    onSetMode(mode === "login" ? "signup" : "login");
                  }}
                  className="text-accent font-semibold ml-1.5 hover:underline cursor-pointer bg-transparent border-none"
                >
                  {mode === "login" ? "สมัครสมาชิกที่นี่" : "เข้าสู่ระบบที่นี่"}
                </button>
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
