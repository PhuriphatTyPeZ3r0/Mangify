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
          {isAdmin && (
            <li>
              <button 
                onClick={() => handleTabClick("admin")}
                className={`py-2 px-1 relative transition-colors hover:text-accent flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  activeTab === "admin" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">shield</span>
                ผู้ดูแลระบบ
                {activeTab === "admin" && (
                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
                )}
              </button>
            </li>
          )}
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
            <div className="flex items-center gap-2 lg:gap-2.5">
              <span className="text-[11px] prompt-light opacity-60 hidden xl:inline max-w-[100px] truncate" title={session.user.email}>
                {session.user.email}
              </span>
              <button 
                onClick={onLogout}
                className="flex items-center gap-1 text-xs prompt-medium text-foreground hover:text-accent border border-border bg-surface px-2.5 py-1.5 md:px-3 lg:px-3.5 rounded-full cursor-pointer transition-colors"
                title="ออกจากระบบ"
              >
                <span className="material-symbols-outlined text-[14px]">logout</span>
                <span className="hidden lg:inline">ออกจากระบบ</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => onOpenAuth("login")}
              className="flex items-center gap-1.5 text-xs prompt-semibold text-background bg-foreground hover:opacity-90 px-3 py-1.5 md:px-4 rounded-full cursor-pointer transition-all shadow-sm"
              title="เข้าสู่ระบบ"
            >
              <span className="material-symbols-outlined text-[14px]">person</span>
              <span className="hidden lg:inline">เข้าสู่ระบบ</span>
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
        <div>
          {/* Drawer Header */}
          <div className="flex justify-between items-center mb-10">
            <span className="prompt-bold text-2xl tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
              Menu
            </span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-surface transition-all flex items-center justify-center"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Vertical Drawer Menu Links */}
          <ul className="flex flex-col gap-6 text-lg font-medium prompt-regular">
            <li>
              <button 
                onClick={() => handleTabClick("originals")}
                className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                  activeTab === "originals" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                หน้าหลัก
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleTabClick("genres")}
                className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                  activeTab === "genres" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                หมวดหมู่
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleTabClick("ranking")}
                className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                  activeTab === "ranking" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                อันดับ
              </button>
            </li>

            <li>
              <button 
                onClick={() => handleTabClick("bookmarks")}
                className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                  activeTab === "bookmarks" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                บุ๊กมาร์ก
              </button>
            </li>
            {isAdmin && (
              <li>
                <button 
                  onClick={() => handleTabClick("admin")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent flex items-center gap-2 transition-colors ${
                    activeTab === "admin" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-accent/80">shield</span>
                  ผู้ดูแลระบบ
                </button>
              </li>
            )}
            <li className="mt-2 border-t border-border/50 pt-4">
              {session ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] prompt-light opacity-60 truncate">
                    ล็อกอิน: {session.user.email}
                  </span>
                  <button 
                    onClick={() => {
                      onLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left py-2 text-accent font-semibold flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    ออกจากระบบ
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    onOpenAuth("login");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left py-2 font-semibold flex items-center gap-2 text-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  เข้าสู่ระบบ
                </button>
              )}
            </li>
          </ul>
        </div>

        {/* Drawer Footer: Themes dots */}
        <div className="border-t border-border pt-6 flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wider opacity-60 prompt-light">Switch Theme</span>
          <div className="flex gap-3">
            {(["light", "sepia", "charcoal", "oled"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => onApplyTheme(t)}
                className={`w-7 h-7 rounded-full border transition-transform ${
                  activeTheme === t ? "scale-110 border-accent" : "border-border"
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
        </div>
      </div>
    </nav>
  );
};
