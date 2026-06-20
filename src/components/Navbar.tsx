import React, { useState } from "react";
import { Theme } from "../types";

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  session: any;
  onLogout: () => Promise<void>;
  onOpenAuth: (mode: "login" | "signup") => void;
  activeTheme: Theme;
  onApplyTheme: (theme: Theme) => void;
  userProfile?: { display_name?: string; username?: string; avatar_url?: string } | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  isAdmin,
  session,
  onLogout,
  onOpenAuth,
  activeTheme,
  onApplyTheme,
  userProfile,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTabClick = (tab: string) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="flex justify-between items-center py-4 mb-8 border-b border-border transition-colors relative">
      {/* Left Side: Logo & Menu links */}
      <div className="flex items-center gap-4 lg:gap-8 xl:gap-10">
        <button 
          onClick={() => handleTabClick("originals")}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <span className="material-symbols-outlined text-accent text-3xl transition-transform group-hover:scale-110 group-hover:rotate-[-5deg]">
            book_5
          </span>
          <span className="prompt-bold text-2xl lg:text-3xl tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent opacity-95">
            Mangify
          </span>
        </button>
        
        {/* Desktop Navigation Links */}
        <ul className="hidden md:flex items-center gap-3 lg:gap-5 xl:gap-6 text-xs lg:text-sm font-medium prompt-regular">
          <li>
            <button 
              onClick={() => handleTabClick("originals")}
              className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${
                activeTab === "originals" ? "text-accent font-semibold" : "opacity-80"
              }`}
            >
              หน้าหลัก
              {activeTab === "originals" && (
                <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
              )}
            </button>
          </li>
          <li>
            <button 
              onClick={() => handleTabClick("genres")}
              className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${
                activeTab === "genres" ? "text-accent font-semibold" : "opacity-80"
              }`}
            >
              หมวดหมู่
              {activeTab === "genres" && (
                <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
              )}
            </button>
          </li>
          <li>
            <button 
              onClick={() => handleTabClick("ranking")}
              className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${
                activeTab === "ranking" ? "text-accent font-semibold" : "opacity-80"
              }`}
            >
              อันดับ
              {activeTab === "ranking" && (
                <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
              )}
            </button>
          </li>

          <li>
            <button 
              onClick={() => handleTabClick("bookmarks")}
              className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${
                activeTab === "bookmarks" ? "text-accent font-semibold" : "opacity-80"
              }`}
            >
              บุ๊กมาร์ก
              {activeTab === "bookmarks" && (
                <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
              )}
            </button>
          </li>
          <li>
            <button 
              onClick={() => handleTabClick("history")}
              className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${
                activeTab === "history" ? "text-accent font-semibold" : "opacity-80"
              }`}
            >
              ประวัติการอ่าน
              {activeTab === "history" && (
                <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
              )}
            </button>
          </li>
        </ul>
      </div>

      {/* Right Side: Auth action & Theme Switcher & Mobile Hamburger Trigger */}
      <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">
        
        {/* Desktop Theme Switcher */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border-r border-border/50 mr-1">
          {(["light", "sepia", "charcoal", "oled"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => onApplyTheme(t)}
              className={`w-4 h-4 rounded-full border transition-all hover:scale-125 cursor-pointer ${
                activeTheme === t ? "ring-2 ring-accent ring-offset-2 ring-offset-background border-accent" : "border-border/60"
              }`}
              style={{
                backgroundColor: 
                  t === "light" ? "#fbfaf7" :
                  t === "sepia" ? "#eedcb8" :
                  t === "charcoal" ? "#22262b" : "#000000"
              }}
              title={`Switch to ${t} theme`}
            />
          ))}
        </div>

        {/* Supabase Auth Desktop Trigger */}
        <div className="hidden md:block">
          {session ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={() => handleTabClick("admin")}
                  className={`flex items-center justify-center p-1.5 rounded-full border transition-all cursor-pointer ${
                    activeTab === "admin"
                      ? "bg-accent text-white border-accent"
                      : "bg-surface border-border text-foreground hover:text-accent hover:border-accent"
                  }`}
                  title="ผู้ดูแลระบบ"
                >
                  <span className="material-symbols-outlined text-[18px]">shield</span>
                </button>
              )}

              <button 
                onClick={() => handleTabClick("profile")}
                className={`w-9 h-9 rounded-full overflow-hidden border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                  activeTab === "profile" ? "ring-2 ring-accent border-accent" : "border-border"
                }`}
                title="โปรไฟล์ของฉัน"
              >
                <img 
                  src={userProfile?.avatar_url || session.user.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80"} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/adventurer/svg?seed=" + (session.user.email || "user");
                  }}
                />
              </button>

              <button 
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-accent border border-border bg-surface px-3.5 py-2 rounded-full cursor-pointer transition-colors active:scale-95"
                title="ออกจากระบบ"
              >
                <span className="material-symbols-outlined text-[16px] text-accent">logout</span>
                <span className="prompt-medium">ออกจากระบบ</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => onOpenAuth("login")}
              className="flex items-center gap-1.5 text-xs prompt-semibold text-background bg-foreground hover:opacity-90 px-4 py-2 rounded-full cursor-pointer transition-all shadow-sm"
              title="เข้าสู่ระบบ"
            >
              <span className="material-symbols-outlined text-[14px]">person</span>
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all cursor-pointer"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-[998] md:hidden transition-opacity"
        />
      )}

      {/* Mobile Slide-in Drawer Menu */}
      <div className={`fixed top-0 right-0 h-full w-[280px] bg-background border-l border-border z-[999] p-6 shadow-xl flex flex-col justify-between transition-transform duration-300 md:hidden ${
        isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        <div className="flex-1 flex flex-col justify-between h-full overflow-y-auto">
          <div>
            {/* Drawer Header */}
            <div className="flex justify-between items-center mb-10">
              <span className="prompt-bold text-2xl tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
                เมนู
              </span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-surface transition-all flex items-center justify-center cursor-pointer"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Vertical Drawer Menu Links */}
            <ul className="flex flex-col gap-5 text-md font-medium prompt-regular">
              <li>
                <button 
                  onClick={() => handleTabClick("originals")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors cursor-pointer ${
                    activeTab === "originals" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  หน้าหลัก
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabClick("genres")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors cursor-pointer ${
                    activeTab === "genres" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  หมวดหมู่
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabClick("ranking")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors cursor-pointer ${
                    activeTab === "ranking" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  อันดับ
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabClick("bookmarks")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors cursor-pointer ${
                    activeTab === "bookmarks" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  บุ๊กมาร์ก
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabClick("history")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors cursor-pointer ${
                    activeTab === "history" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  ประวัติการอ่าน
                </button>
              </li>
              {isAdmin && (
                <li>
                  <button 
                    onClick={() => handleTabClick("admin")}
                    className={`w-full text-left py-2 border-b border-transparent hover:text-accent flex items-center gap-2 transition-colors cursor-pointer ${
                      activeTab === "admin" ? "text-accent font-semibold" : "opacity-80"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] text-accent/80">shield</span>
                    ผู้ดูแลระบบ
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* User profile & theme selector at the bottom */}
          <div className="mt-8 border-t border-border/50 pt-6 space-y-6">
            {session ? (
              <div className="space-y-4">
                {/* Profile Card clickable to profile tab */}
                <div 
                  onClick={() => {
                    handleTabClick("profile");
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border group-hover:border-accent transition-all">
                    <img 
                      src={userProfile?.avatar_url || session.user.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80"} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/adventurer/svg?seed=" + (session.user.email || "user");
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="prompt-semibold text-sm truncate group-hover:text-accent transition-colors">
                      {userProfile?.display_name || session.user.user_metadata?.full_name || "Phuriphat Hemakul"}
                    </h4>
                    <p className="prompt-light text-xs opacity-60 truncate">
                      {userProfile?.username || session.user.email?.split("@")[0] || "phuriphat.phx"}
                    </p>
                  </div>
                </div>

                {/* Logout Button in orange text / orange accent */}
                <button 
                  onClick={() => {
                    onLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left py-2 text-accent font-semibold flex items-center gap-2 text-sm cursor-pointer hover:opacity-80 transition-all active:scale-98"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  onOpenAuth("login");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2.5 px-4 font-semibold flex items-center justify-center gap-2 text-sm bg-foreground text-background rounded-full cursor-pointer hover:opacity-90 transition-all active:scale-98"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
                เข้าสู่ระบบ
              </button>
            )}

            {/* Theme Selector */}
            <div className="border-t border-border/50 pt-5 flex flex-col gap-2.5">
              <span className="text-xs font-semibold opacity-80 prompt-medium">เปลี่ยนธีม</span>
              <div className="flex gap-3">
                {(["light", "sepia", "charcoal", "oled"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => onApplyTheme(t)}
                    className={`w-8 h-8 rounded-full border transition-all hover:scale-110 cursor-pointer ${
                      activeTheme === t ? "ring-2 ring-accent ring-offset-2 ring-offset-background border-accent" : "border-border/60"
                    }`}
                    style={{
                      backgroundColor: 
                        t === "light" ? "#fbfaf7" :
                        t === "sepia" ? "#eedcb8" :
                        t === "charcoal" ? "#22262b" : "#000000"
                    }}
                    title={`เปลี่ยนเป็นธีม ${t}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
