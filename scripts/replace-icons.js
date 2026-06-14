const fs = require("fs");
const path = require("path");

const pageFile = path.join(__dirname, "../src/app/page.tsx");
if (!fs.existsSync(pageFile)) {
  console.error("page.tsx not found!");
  process.exit(1);
}

let content = fs.readFileSync(pageFile, "utf-8");

// Normalize all newlines to \n to prevent CRLF vs LF mismatches on Windows
content = content.replace(/\r\n/g, "\n");

// 1. Replace lucide import statement
const lucideImport = 'import {\n' +
  '  BookOpen,\n' +
  '  ChevronLeft,\n' +
  '  ChevronRight,\n' +
  '  ChevronUp,\n' +
  '  ChevronDown,\n' +
  '  Menu,\n' +
  '  X,\n' +
  '  TrendingUp,\n' +
  '  Filter,\n' +
  '  Sparkles,\n' +
  '  Layers,\n' +
  '  Bookmark,\n' +
  '  User,\n' +
  '  Lock,\n' +
  '  UploadCloud,\n' +
  '  FileArchive,\n' +
  '  LogOut,\n' +
  '  Plus,\n' +
  '  Loader2,\n' +
  '  Shield\n' +
  '} from "lucide-react";';

if (content.includes(lucideImport)) {
  content = content.replace(lucideImport, "/* Imported Google Material Symbols via layout.tsx */");
  console.log("Replaced lucide-react import");
} else {
  // Normalize spacing in case import is formatted differently
  const regexImport = /import\s+{[^}]+}\s+from\s+"lucide-react";/g;
  content = content.replace(regexImport, "/* Imported Google Material Symbols via layout.tsx */");
  console.log("Replaced lucide-react import using regex");
}

// 2. Replace desktop navbar logo + left links (with responsiveness fixes)
const originalDesktopLeft = '        {/* Left Side: Logo & Menu links */}\n' +
  '        <div className="flex items-center gap-10">\n' +
  '          <button \n' +
  '            onClick={() => handleTabChange("originals")}\n' +
  '            className="prompt-bold text-3xl tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent hover:opacity-90 cursor-pointer"\n' +
  '          >\n' +
  '            Mangify\n' +
  '          </button>\n' +
  '          \n' +
  '          {/* Desktop Navigation Links */}\n' +
  '          <ul className="hidden md:flex items-center gap-6 text-sm font-medium prompt-regular">\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("originals")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${\n' +
  '                  activeTab === "originals" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                ออริจินัล\n' +
  '                {activeTab === "originals" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("genres")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${\n' +
  '                  activeTab === "genres" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                หมวดหมู่\n' +
  '                {activeTab === "genres" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("ranking")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${\n' +
  '                  activeTab === "ranking" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                อันดับ\n' +
  '                {activeTab === "ranking" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("canvas")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${\n' +
  '                  activeTab === "canvas" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                CANVAS\n' +
  '                {activeTab === "canvas" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("bookmarks")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${\n' +
  '                  activeTab === "bookmarks" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                บุ๊กมาร์ก\n' +
  '                {activeTab === "bookmarks" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            {isAdmin && (\n' +
  '              <li>\n' +
  '                <button \n' +
  '                  onClick={() => handleTabChange("admin")}\n' +
  '                  className={`py-2 px-1 relative transition-colors hover:text-accent flex items-center gap-1 cursor-pointer ${\n' +
  '                    activeTab === "admin" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                  }`}\n' +
  '                >\n' +
  '                  <Shield className="w-3.5 h-3.5" />\n' +
  '                  ผู้ดูแลระบบ\n' +
  '                  {activeTab === "admin" && (\n' +
  '                    <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                  )}\n' +
  '                </button>\n' +
  '              </li>\n' +
  '            )}\n' +
  '          </ul>\n' +
  '        </div>';

const newDesktopLeft = '        {/* Left Side: Logo & Menu links */}\n' +
  '        <div className="flex items-center gap-4 lg:gap-8 xl:gap-10">\n' +
  '          <button \n' +
  '            onClick={() => handleTabChange("originals")}\n' +
  '            className="prompt-bold text-2xl lg:text-3xl tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent hover:opacity-90 cursor-pointer flex-shrink-0"\n' +
  '          >\n' +
  '            Mangify\n' +
  '          </button>\n' +
  '          \n' +
  '          {/* Desktop Navigation Links */}\n' +
  '          <ul className="hidden md:flex items-center gap-3 lg:gap-5 xl:gap-6 text-xs lg:text-sm font-medium prompt-regular">\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("originals")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${\n' +
  '                  activeTab === "originals" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                ออริจินัล\n' +
  '                {activeTab === "originals" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("genres")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${\n' +
  '                  activeTab === "genres" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                หมวดหมู่\n' +
  '                {activeTab === "genres" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("ranking")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${\n' +
  '                  activeTab === "ranking" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                อันดับ\n' +
  '                {activeTab === "ranking" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("canvas")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${\n' +
  '                  activeTab === "canvas" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                CANVAS\n' +
  '                {activeTab === "canvas" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            <li>\n' +
  '              <button \n' +
  '                onClick={() => handleTabChange("bookmarks")}\n' +
  '                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer whitespace-nowrap ${\n' +
  '                  activeTab === "bookmarks" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                }`}\n' +
  '              >\n' +
  '                บุ๊กมาร์ก\n' +
  '                {activeTab === "bookmarks" && (\n' +
  '                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                )}\n' +
  '              </button>\n' +
  '            </li>\n' +
  '            {isAdmin && (\n' +
  '              <li>\n' +
  '                <button \n' +
  '                  onClick={() => handleTabChange("admin")}\n' +
  '                  className={`py-2 px-1 relative transition-colors hover:text-accent flex items-center gap-1 cursor-pointer whitespace-nowrap ${\n' +
  '                    activeTab === "admin" ? "text-accent font-semibold" : "opacity-80"\n' +
  '                  }`}\n' +
  '                >\n' +
  '                  <span className="material-symbols-outlined text-[14px]">shield</span>\n' +
  '                  ผู้ดูแลระบบ\n' +
  '                  {activeTab === "admin" && (\n' +
  '                    <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />\n' +
  '                  )}\n' +
  '                </button>\n' +
  '              </li>\n' +
  '            )}\n' +
  '          </ul>\n' +
  '        </div>';

if (content.includes(originalDesktopLeft)) {
  content = content.replace(originalDesktopLeft, newDesktopLeft);
  console.log("Successfully replaced desktop left side navigation");
} else {
  console.log("Failed to match originalDesktopLeft block!");
}

// 3. Replace right side navbar (with theme dots removed and auth buttons updated to Material Symbols)
const originalDesktopRight = '        {/* Right Side: Theme Dots & Auth action & Mobile Hamburger Trigger */}\n' +
  '        <div className="flex items-center gap-4">\n' +
  '          {/* Desktop Theme Dots */}\n' +
  '          <div className="hidden md:flex gap-2">\n' +
  '            {(["light", "sepia", "charcoal", "oled"] as Theme[]).map((t) => (\n' +
  '              <button\n' +
  '                key={t}\n' +
  '                onClick={() => applyTheme(t)}\n' +
  '                className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${\n' +
  '                  activeTheme === t ? "scale-125 border-accent" : "border-border hover:scale-110"\n' +
  '                }`}\n' +
  '                style={{\n' +
  '                  backgroundColor: \n' +
  '                    t === "light" ? "#fbfaf7" :\n' +
  '                    t === "sepia" ? "#eedcb8" :\n' +
  '                    t === "charcoal" ? "#22262b" : "#000000"\n' +
  '                }}\n' +
  '                title={`Switch to ${t} theme`}\n' +
  '              />\n' +
  '            ))}\n' +
  '          </div>\n' +
  '\n' +
  '          {/* Supabase Auth Desktop Trigger */}\n' +
  '          <div className="hidden md:block">\n' +
  '            {session ? (\n' +
  '              <div className="flex items-center gap-2.5">\n' +
  '                <span className="text-[11px] prompt-light opacity-60 hidden lg:inline max-w-[100px] truncate" title={session.user.email}>\n' +
  '                  {session.user.email}\n' +
  '                </span>\n' +
  '                <button \n' +
  '                  onClick={handleLogout}\n' +
  '                  className="flex items-center gap-1 text-xs prompt-medium text-foreground hover:text-accent border border-border bg-surface px-3.5 py-1.5 rounded-full cursor-pointer transition-colors"\n' +
  '                >\n' +
  '                  <LogOut className="w-3.5 h-3.5" />\n' +
  '                  ออกจากระบบ\n' +
  '                </button>\n' +
  '              </div>\n' +
  '            ) : (\n' +
  '              <button \n' +
  '                onClick={() => {\n' +
  '                  setAuthMode("login");\n' +
  '                  setIsAuthModalOpen(true);\n' +
  '                  setAuthError(null);\n' +
  '                }}\n' +
  '                className="flex items-center gap-1.5 text-xs prompt-semibold text-background bg-foreground hover:opacity-90 px-4 py-1.5 rounded-full cursor-pointer transition-all shadow-sm"\n' +
  '              >\n' +
  '                <User className="w-3.5 h-3.5" />\n' +
  '                เข้าสู่ระบบ\n' +
  '              </button>\n' +
  '            )}\n' +
  '          </div>\n' +
  ' \n' +
  '          {/* Mobile Hamburger Button */}\n' +
  '          <button \n' +
  '            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}\n' +
  '            className="md:hidden p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all cursor-pointer"\n' +
  '            aria-label="Open menu"\n' +
  '          >\n' +
  '            <Menu className="w-6 h-6" />\n' +
  '          </button>\n' +
  '        </div>';

const newDesktopRight = '        {/* Right Side: Auth action & Mobile Hamburger Trigger */}\n' +
  '        <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">\n' +
  '          {/* Supabase Auth Desktop Trigger */}\n' +
  '          <div className="hidden md:block">\n' +
  '            {session ? (\n' +
  '              <div className="flex items-center gap-2 lg:gap-2.5">\n' +
  '                <span className="text-[11px] prompt-light opacity-60 hidden xl:inline max-w-[100px] truncate" title={session.user.email}>\n' +
  '                  {session.user.email}\n' +
  '                </span>\n' +
  '                <button \n' +
  '                  onClick={handleLogout}\n' +
  '                  className="flex items-center gap-1 text-xs prompt-medium text-foreground hover:text-accent border border-border bg-surface px-2.5 py-1.5 md:px-3 lg:px-3.5 rounded-full cursor-pointer transition-colors"\n' +
  '                  title="ออกจากระบบ"\n' +
  '                >\n' +
  '                  <span className="material-symbols-outlined text-[14px]">logout</span>\n' +
  '                  <span className="hidden lg:inline">ออกจากระบบ</span>\n' +
  '                </button>\n' +
  '              </div>\n' +
  '            ) : (\n' +
  '              <button \n' +
  '                onClick={() => {\n' +
  '                  setAuthMode("login");\n' +
  '                  setIsAuthModalOpen(true);\n' +
  '                  setAuthError(null);\n' +
  '                }}\n' +
  '                className="flex items-center gap-1.5 text-xs prompt-semibold text-background bg-foreground hover:opacity-90 px-3 py-1.5 md:px-4 rounded-full cursor-pointer transition-all shadow-sm"\n' +
  '                title="เข้าสู่ระบบ"\n' +
  '              >\n' +
  '                <span className="material-symbols-outlined text-[14px]">person</span>\n' +
  '                <span className="hidden lg:inline">เข้าสู่ระบบ</span>\n' +
  '              </button>\n' +
  '            )}\n' +
  '          </div>\n' +
  ' \n' +
  '          {/* Mobile Hamburger Button */}\n' +
  '          <button \n' +
  '            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}\n' +
  '            className="md:hidden p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all cursor-pointer"\n' +
  '            aria-label="Open menu"\n' +
  '          >\n' +
  '            <span className="material-symbols-outlined text-[24px]">menu</span>\n' +
  '          </button>\n' +
  '        </div>';

if (content.includes(originalDesktopRight)) {
  content = content.replace(originalDesktopRight, newDesktopRight);
  console.log("Successfully replaced desktop right side navigation");
} else {
  console.log("Failed to match originalDesktopRight block!");
}

// 4. Replace Mobile Drawer Menu Header close button, links, and footer
const originalDrawerHeader = '<button \n' +
  '                onClick={() => setIsMobileMenuOpen(false)}\n' +
  '                className="p-2 rounded-lg hover:bg-surface transition-all"\n' +
  '                aria-label="Close menu"\n' +
  '              >\n' +
  '                <X className="w-5 h-5" />\n' +
  '              </button>';
const newDrawerHeader = '<button \n' +
  '                onClick={() => setIsMobileMenuOpen(false)}\n' +
  '                className="p-2 rounded-lg hover:bg-surface transition-all flex items-center justify-center"\n' +
  '                aria-label="Close menu"\n' +
  '              >\n' +
  '                <span className="material-symbols-outlined text-[20px]">close</span>\n' +
  '              </button>';
content = content.replace(originalDrawerHeader, newDrawerHeader);

const originalDrawerAdmin = '<Shield className="w-4 h-4 text-accent/80" />';
const newDrawerAdmin = '<span className="material-symbols-outlined text-[16px] text-accent/80">shield</span>';
content = content.replace(originalDrawerAdmin, newDrawerAdmin);

const originalDrawerLogout = '<LogOut className="w-4 h-4" />';
const newDrawerLogout = '<span className="material-symbols-outlined text-[16px]">logout</span>';
content = content.replace(originalDrawerLogout, newDrawerLogout);

const originalDrawerLogin = '<User className="w-4 h-4" />';
const newDrawerLogin = '<span className="material-symbols-outlined text-[16px]">person</span>';
content = content.replace(originalDrawerLogin, newDrawerLogin);

// 5. Replace Main Page Headers (Originals, Genres, Ranking, Canvas, Bookmarks)
const originalHeaders = '{activeTab === "originals" && <Sparkles className="w-5 h-5 opacity-70" />}\n' +
  '              {activeTab === "genres" && <Filter className="w-5 h-5 opacity-70" />}\n' +
  '              {activeTab === "ranking" && <TrendingUp className="w-5 h-5 opacity-70" />}\n' +
  '              {activeTab === "canvas" && <Layers className="w-5 h-5 opacity-70" />}\n' +
  '              {activeTab === "bookmarks" && <Bookmark className="w-5 h-5 opacity-70" />}';

const newHeaders = '{activeTab === "originals" && <span className="material-symbols-outlined text-[20px] opacity-70">auto_awesome</span>}\n' +
  '              {activeTab === "genres" && <span className="material-symbols-outlined text-[20px] opacity-70">filter_list</span>}\n' +
  '              {activeTab === "ranking" && <span className="material-symbols-outlined text-[20px] opacity-70">trending_up</span>}\n' +
  '              {activeTab === "canvas" && <span className="material-symbols-outlined text-[20px] opacity-70">layers</span>}\n' +
  '              {activeTab === "bookmarks" && <span className="material-symbols-outlined text-[20px] opacity-70">bookmark</span>}';

content = content.replace(originalHeaders, newHeaders);

// 6. Replace Filter/Sort subheader icons
const originalFilterSub = '<Filter className="w-3.5 h-3.5" />';
const newFilterSub = '<span className="material-symbols-outlined text-[14px]">filter_list</span>';
content = content.replace(originalFilterSub, newFilterSub);

const originalSortSub = '<TrendingUp className="w-3.5 h-3.5" />';
const newSortSub = '<span className="material-symbols-outlined text-[14px]">trending_up</span>';
content = content.replace(originalSortSub, newSortSub);

// 7. Replace Manga Card Bookmark button
const originalCardBookmark = '<Bookmark \n' +
  '                          size={14} \n' +
  '                          className={bookmarks.includes(manga.id) ? "fill-accent text-accent" : "opacity-70"} \n' +
  '                        />';
const newCardBookmark = '<span className={`material-symbols-outlined text-[14px] ${bookmarks.includes(manga.id) ? "fill text-accent" : "opacity-70"}`}>\n' +
  '                          bookmark\n' +
  '                        </span>';
content = content.replace(originalCardBookmark, newCardBookmark);

// 8. Replace Admin Portal Header Shield icon
const originalAdminHeader = '<Shield className="w-6 h-6 text-accent" />';
const newAdminHeader = '<span className="material-symbols-outlined text-[24px] text-accent">shield</span>';
content = content.replace(originalAdminHeader, newAdminHeader);

// 9. Replace Admin Ingest form button icons (Loader2 & UploadCloud)
const originalIngestButton = '<button\n' +
  '                type="submit"\n' +
  '                disabled={adminLoading}\n' +
  '                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"\n' +
  '              >\n' +
  '                {adminLoading ? (\n' +
  '                  <>\n' +
  '                    <Loader2 className="w-4 h-4 animate-spin" />\n' +
  '                    กำลังส่งคิวให้ GitHub Actions...\n' +
  '                  </>\n' +
  '                ) : (\n' +
  '                  <>\n' +
  '                    <UploadCloud className="w-4 h-4" />\n' +
  '                    เริ่มกระบวนการจัดเก็บรูปภาพ (Ingest)\n' +
  '                  </>\n' +
  '                )}\n' +
  '              </button>';

const newIngestButton = '<button\n' +
  '                type="submit"\n' +
  '                disabled={adminLoading}\n' +
  '                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"\n' +
  '              >\n' +
  '                {adminLoading ? (\n' +
  '                  <>\n' +
  '                    <span className="material-symbols-outlined text-[16px] animate-spin">cached</span>\n' +
  '                    กำลังส่งคิวให้ GitHub Actions...\n' +
  '                  </>\n' +
  '                ) : (\n' +
  '                  <>\n' +
  '                    <span className="material-symbols-outlined text-[16px]">cloud_upload</span>\n' +
  '                    เริ่มกระบวนการจัดเก็บรูปภาพ (Ingest)\n' +
  '                  </>\n' +
  '                )}\n' +
  '              </button>';

content = content.replace(originalIngestButton, newIngestButton);

// 10. Replace Reader top bar ChevronLeft "Library"
const originalReaderTopChevron = '<button \n' +
  '                onClick={handleCloseReader}\n' +
  '                className="flex items-center gap-1 prompt-medium text-sm hover:translate-x-[-3px] transition-transform"\n' +
  '              >\n' +
  '                <ChevronLeft className="w-5 h-5" />\n' +
  '                Library\n' +
  '              </button>';

const newReaderTopChevron = '<button \n' +
  '                onClick={handleCloseReader}\n' +
  '                className="flex items-center gap-1 prompt-medium text-sm hover:translate-x-[-3px] transition-transform flex items-center"\n' +
  '              >\n' +
  '                <span className="material-symbols-outlined text-[20px]">chevron_left</span>\n' +
  '                Library\n' +
  '              </button>';

content = content.replace(originalReaderTopChevron, newReaderTopChevron);

// 11. Replace Reader bottom bar icons (ChevronLeft, ChevronRight, ChevronUp, ChevronDown)
const originalReaderPrev = '<button\n' +
  '                  disabled={currentChapterIdx <= 0}\n' +
  '                  onClick={() => {\n' +
  '                    if (currentChapterIdx > 0 && activeManga) {\n' +
  '                      const prevChId = activeManga.chapters[currentChapterIdx - 1].id;\n' +
  '                      launchReader(activeManga, prevChId, 0, 0);\n' +
  '                    }\n' +
  '                    resetControlsTimeout();\n' +
  '                  }}\n' +
  '                  className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"\n' +
  '                  title="ตอนก่อนหน้า"\n' +
  '                >\n' +
  '                  <ChevronLeft size={16} />\n' +
  '                </button>';

const newReaderPrev = '<button\n' +
  '                  disabled={currentChapterIdx <= 0}\n' +
  '                  onClick={() => {\n' +
  '                    if (currentChapterIdx > 0 && activeManga) {\n' +
  '                      const prevChId = activeManga.chapters[currentChapterIdx - 1].id;\n' +
  '                      launchReader(activeManga, prevChId, 0, 0);\n' +
  '                    }\n' +
  '                    resetControlsTimeout();\n' +
  '                  }}\n' +
  '                  className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"\n' +
  '                  title="ตอนก่อนหน้า"\n' +
  '                >\n' +
  '                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>\n' +
  '                </button>';

content = content.replace(originalReaderPrev, newReaderPrev);

const originalReaderNext = '<button\n' +
  '                  disabled={currentChapterIdx >= (activeManga?.chapters.length || 0) - 1}\n' +
  '                  onClick={() => {\n' +
  '                    if (activeManga && currentChapterIdx < activeManga.chapters.length - 1) {\n' +
  '                      const nextChId = activeManga.chapters[currentChapterIdx + 1].id;\n' +
  '                      launchReader(activeManga, nextChId, 0, 0);\n' +
  '                    }\n' +
  '                    resetControlsTimeout();\n' +
  '                  }}\n' +
  '                  className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"\n' +
  '                  title="ตอนถัดไป"\n' +
  '                >\n' +
  '                  <ChevronRight size={16} />\n' +
  '                </button>';

const newReaderNext = '<button\n' +
  '                  disabled={currentChapterIdx >= (activeManga?.chapters.length || 0) - 1}\n' +
  '                  onClick={() => {\n' +
  '                    if (activeManga && currentChapterIdx < activeManga.chapters.length - 1) {\n' +
  '                      const nextChId = activeManga.chapters[currentChapterIdx + 1].id;\n' +
  '                      launchReader(activeManga, nextChId, 0, 0);\n' +
  '                    }\n' +
  '                    resetControlsTimeout();\n' +
  '                  }}\n' +
  '                  className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"\n' +
  '                  title="ตอนถัดไป"\n' +
  '                >\n' +
  '                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>\n' +
  '                </button>';

content = content.replace(originalReaderNext, newReaderNext);

const originalReaderDropdown = '<button \n' +
  '                  onClick={() => {\n' +
  '                    setIsChapterPanelOpen(!isChapterPanelOpen);\n' +
  '                    resetControlsTimeout();\n' +
  '                  }}\n' +
  '                  className="px-3 py-1 rounded-full text-foreground text-xs prompt-medium hover:bg-foreground/5 transition-colors flex items-center gap-1 cursor-pointer"\n' +
  '                >\n' +
  '                  <span className="max-w-[120px] sm:max-w-[160px] truncate">\n' +
  '                    {currentChapter?.title || "เลือกตอน"}\n' +
  '                  </span>\n' +
  '                  {isChapterPanelOpen ? (\n' +
  '                    <ChevronUp size={14} className="text-accent opacity-80" />\n' +
  '                  ) : (\n' +
  '                    <ChevronDown size={14} className="opacity-60" />\n' +
  '                  )}\n' +
  '                </button>';

const newReaderDropdown = '<button \n' +
  '                  onClick={() => {\n' +
  '                    setIsChapterPanelOpen(!isChapterPanelOpen);\n' +
  '                    resetControlsTimeout();\n' +
  '                  }}\n' +
  '                  className="px-3 py-1 rounded-full text-foreground text-xs prompt-medium hover:bg-foreground/5 transition-colors flex items-center gap-1 cursor-pointer"\n' +
  '                >\n' +
  '                  <span className="max-w-[120px] sm:max-w-[160px] truncate">\n' +
  '                    {currentChapter?.title || "เลือกตอน"}\n' +
  '                  </span>\n' +
  '                  {isChapterPanelOpen ? (\n' +
  '                    <span className="material-symbols-outlined text-[14px] text-accent opacity-80">expand_less</span>\n' +
  '                  ) : (\n' +
  '                    <span className="material-symbols-outlined text-[14px] opacity-60">expand_more</span>\n' +
  '                  )}\n' +
  '                </button>';

content = content.replace(originalReaderDropdown, newReaderDropdown);

// 12. Add Floating Theme Switcher at bottom
const originalMainEnd = '      </main>\n\n      {/* Fullscreen Immersive Reader Overlay */}';
const newMainEnd = '      </main>\n\n' +
  '      {/* Floating Theme Switcher */}\n' +
  '      <div className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-3 bg-surface/80 backdrop-blur-md border border-border p-2.5 px-4 rounded-full shadow-lg hover:shadow-xl hover:border-accent/40 transition-all duration-300 hover:-translate-y-0.5">\n' +
  '        <div className="flex items-center gap-1.5 text-foreground/70 text-xs prompt-semibold select-none">\n' +
  '          <span className="material-symbols-outlined text-[16px] text-accent">palette</span>\n' +
  '          <span className="hidden lg:inline opacity-80">ธีม</span>\n' +
  '        </div>\n' +
  '        <div className="w-[1px] h-4 bg-border hidden lg:block" />\n' +
  '        <div className="flex gap-2">\n' +
  '          {(["light", "sepia", "charcoal", "oled"] as Theme[]).map((t) => (\n' +
  '            <button\n' +
  '              key={t}\n' +
  '              onClick={() => applyTheme(t)}\n' +
  '              className={`w-5 h-5 rounded-full border transition-all cursor-pointer hover:scale-110 ${\n' +
  '                activeTheme === t \n' +
  '                  ? "scale-115 border-accent ring-2 ring-accent/20" \n' +
  '                  : "border-border"\n' +
  '              }`}\n' +
  '              style={{\n' +
  '                backgroundColor: \n' +
  '                  t === "light" ? "#fbfaf7" :\n' +
  '                  t === "sepia" ? "#eedcb8" :\n' +
  '                  t === "charcoal" ? "#22262b" : "#000000"\n' +
  '              }}\n' +
  '              title={`Switch to ${t} theme`}\n' +
  '            />\n' +
  '          ))}\n' +
  '        </div>\n' +
  '      </div>\n\n' +
  '      {/* Fullscreen Immersive Reader Overlay */}';

content = content.replace(originalMainEnd, newMainEnd);

// 13. Replace Auth modal close button
const originalAuthClose = '            {/* Close Button */}\n' +
  '            <button \n' +
  '              onClick={() => setIsAuthModalOpen(false)}\n' +
  '              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer text-foreground"\n' +
  '              aria-label="Close auth modal"\n' +
  '            >\n' +
  '              <X className="w-5 h-5" />\n' +
  '            </button>';

const newAuthClose = '            {/* Close Button */}\n' +
  '            <button \n' +
  '              onClick={() => setIsAuthModalOpen(false)}\n' +
  '              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer text-foreground flex items-center justify-center"\n' +
  '              aria-label="Close auth modal"\n' +
  '            >\n' +
  '              <span className="material-symbols-outlined text-[20px]">close</span>\n' +
  '            </button>';

content = content.replace(originalAuthClose, newAuthClose);

// 14. Replace Auth modal submit loading state icon
const originalAuthSubmit = '              <button\n' +
  '                type="submit"\n' +
  '                disabled={authLoading}\n' +
  '                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"\n' +
  '              >\n' +
  '                {authLoading ? (\n' +
  '                  <>\n' +
  '                    <Loader2 className="w-4 h-4 animate-spin" />\n' +
  '                    กำลังดำเนินการ...\n' +
  '                  </>\n' +
  '                ) : (';

const newAuthSubmit = '              <button\n' +
  '                type="submit"\n' +
  '                disabled={authLoading}\n' +
  '                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"\n' +
  '              >\n' +
  '                {authLoading ? (\n' +
  '                  <>\n' +
  '                    <span className="material-symbols-outlined text-[16px] animate-spin">cached</span>\n' +
  '                    กำลังดำเนินการ...\n' +
  '                  </>\n' +
  '                ) : (';

content = content.replace(originalAuthSubmit, newAuthSubmit);


// Convert back to CRLF or keep as LF (Next.js compiles both cleanly)
fs.writeFileSync(pageFile, content, "utf-8");
console.log("Successfully replaced all icons and layouts in page.tsx!");
