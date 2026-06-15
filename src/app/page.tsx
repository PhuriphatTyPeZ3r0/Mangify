"use client";

import React, { useState, useEffect, useRef } from "react";
/* Imported Google Material Symbols via layout.tsx */
import { demoManga as initialManga } from "../data/mangaData";
import { Manga, Theme, ReadingMode, ReadingProgress } from "../types";
import { supabase } from "../lib/supabaseClient";

// Import Refactored Components
import { Navbar } from "../components/Navbar";
import { LibraryGrid } from "../components/LibraryGrid";
import { MangaInfoModal } from "../components/MangaInfoModal";
import { ReaderOverlay } from "../components/ReaderOverlay";
import { AuthModal } from "../components/AuthModal";
import { AdminPortal } from "../components/AdminPortal";
import { QuickResumeBanner } from "../components/QuickResumeBanner";

export default function Home() {
  // --- Core State ---
  const [mangas, setMangas] = useState<Manga[]>(initialManga);
  const [activeTab, setActiveTab] = useState("originals");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("popular");
  
  // --- UI state ---
  const [activeTheme, setActiveTheme] = useState<Theme>("light");
  const [selectedMangaInfo, setSelectedMangaInfo] = useState<Manga | null>(null);
  const [history, setHistory] = useState<ReadingProgress | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  
  // --- Auth State ---
  const [session, setSession] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- Reader State ---
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [activeManga, setActiveManga] = useState<Manga | null>(null);
  const [activeChapterId, setActiveChapterId] = useState("");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>("vertical");
  const [showControls, setShowControls] = useState(true);
  const [isChapterPanelOpen, setIsChapterPanelOpen] = useState(false);
  
  // --- Admin State ---
  const [adminInput, setAdminInput] = useState({
    mangaId: "",
    chapterId: "",
    chapterTitle: "",
    zipUrl: ""
  });
  const [ingesting, setIngesting] = useState(false);
  const [adminLogs, setAdminLogs] = useState<string[]>([]);

  // --- Refs ---
  const readerContentRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Functions (Defined before useEffect to avoid ReferenceError) ---
  
  const fetchMangas = async () => {
    try {
      const res = await fetch("/api/catalog");
      const data = await res.json();
      if (data.mangas) setMangas(data.mangas);
    } catch (err) {
      console.error("Failed to fetch mangas:", err);
    }
  };

  const checkAdminStatus = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/check?userId=${userId}`);
      const data = await res.json();
      setIsAdmin(!!data.isAdmin);
    } catch (err) {
      setIsAdmin(false);
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch Progress
      const pRes = await fetch(`/api/sync/progress?userId=${userId}`);
      const pData = await pRes.json();
      if (pData.progress && pData.progress.length > 0) {
        const last = pData.progress[0];
        setHistory({
          mangaId: last.manga_id,
          chapterId: last.chapter_id,
          pageIndex: last.page_index,
          scrollPercent: last.scroll_percent
        });
      }

      // Fetch Bookmarks
      const bRes = await fetch(`/api/sync/bookmarks?userId=${userId}`);
      const bData = await bRes.json();
      if (bData.bookmarks) {
        setBookmarks(bData.bookmarks.map((b: any) => b.manga_id));
      }
    } catch (err) {
      console.error("Sync error:", err);
    }
  };

  const loadLocalData = () => {
    const localHistory = localStorage.getItem("mangify-history");
    if (localHistory) setHistory(JSON.parse(localHistory));
    
    const localBookmarks = localStorage.getItem("mangify-bookmarks");
    if (localBookmarks) setBookmarks(JSON.parse(localBookmarks));
  };

  const applyTheme = (theme: Theme) => {
    setActiveTheme(theme);
    localStorage.setItem("mangify-theme", theme);
    document.documentElement.className = `theme-${theme}`; // Fix: Use className on root
    document.documentElement.setAttribute("data-theme", theme);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleBookmark = async (e: React.MouseEvent, mangaId: string) => {
    e.stopPropagation();
    let newBookmarks = [...bookmarks];
    if (bookmarks.includes(mangaId)) {
      newBookmarks = newBookmarks.filter(id => id !== mangaId);
    } else {
      newBookmarks.push(mangaId);
    }
    setBookmarks(newBookmarks);

    if (session) {
      // Sync to Cloud
      await fetch("/api/sync/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, mangaId })
      });
    } else {
      localStorage.setItem("mangify-bookmarks", JSON.stringify(newBookmarks));
    }
  };

  const handleLaunchReader = (manga: Manga, chapterId: string, pageIndex = 0, scrollPct = 0) => {
    setActiveManga(manga);
    setActiveChapterId(chapterId);
    setCurrentPageIndex(pageIndex);
    setScrollPercent(scrollPct);
    setIsReaderOpen(true);
    resetControlsTimeout();
    
    // Auto-scroll logic if vertical
    if (readingMode === "vertical" && scrollPct > 0) {
      setTimeout(() => {
        if (readerContentRef.current) {
          const totalHeight = readerContentRef.current.scrollHeight;
          readerContentRef.current.scrollTop = (scrollPct / 100) * totalHeight;
        }
      }, 100);
    }
  };

  const handleReaderClose = () => {
    setIsReaderOpen(false);
    setActiveManga(null);
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isChapterPanelOpen) setShowControls(false);
    }, 4000);
  };

  const handleReaderScroll = () => {
    if (!readerContentRef.current || readingMode !== "vertical") return;
    
    const { scrollTop, scrollHeight, clientHeight } = readerContentRef.current;
    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setScrollPercent(progress);
    
    debouncedSyncProgress(progress, 0);
  };

  const debouncedSyncProgress = (scroll: number, page: number) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      if (!activeManga || !activeChapterId) return;
      
      const progress: ReadingProgress = {
        mangaId: activeManga.id,
        chapterId: activeChapterId,
        pageIndex: page,
        scrollPercent: scroll
      };
      
      setHistory(progress);

      if (session) {
        fetch("/api/sync/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id, ...progress })
        });
      } else {
        localStorage.setItem("mangify-history", JSON.stringify(progress));
      }
    }, 1000);
  };

  const handleNavigateHorizontal = (dir: number) => {
    if (!activeManga || !activeChapterId) return;
    const ch = activeManga.chapters.find(c => c.id === activeChapterId);
    if (!ch) return;

    let nextIdx = currentPageIndex + dir;
    if (nextIdx >= 0 && nextIdx < ch.pages.length) {
      setCurrentPageIndex(nextIdx);
      const pct = (nextIdx / (ch.pages.length - 1)) * 100;
      setScrollPercent(pct);
      debouncedSyncProgress(pct, nextIdx);
      resetControlsTimeout();
    } else if (nextIdx >= ch.pages.length) {
      // Load next chapter
      const curIdx = activeManga.chapters.findIndex(c => c.id === activeChapterId);
      if (curIdx < activeManga.chapters.length - 1) {
        handleLaunchReader(activeManga, activeManga.chapters[curIdx + 1].id, 0, 0);
      }
    } else if (nextIdx < 0) {
      // Load prev chapter
      const curIdx = activeManga.chapters.findIndex(c => c.id === activeChapterId);
      if (curIdx > 0) {
        const prevCh = activeManga.chapters[curIdx - 1];
        handleLaunchReader(activeManga, prevCh.id, prevCh.pages.length - 1, 100);
      }
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        setAuthMode("login");
        setAuthError("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setIsAuthModalOpen(false);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setHistory(null);
    setBookmarks([]);
    setAdminLogs([]);
    setActiveTab("originals");
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngesting(true);
    setAdminLogs(prev => ["Starting ingestion trigger...", ...prev]);

    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminInput)
      });
      const data = await res.json();
      if (data.success) {
        setAdminLogs(prev => [`SUCCESS: ${data.message || "Action triggered"}`, ...prev]);
        setAdminInput({ mangaId: "", chapterId: "", chapterTitle: "", zipUrl: "" });
      } else {
        setAdminLogs(prev => [`ERROR: ${data.error}`, ...prev]);
      }
    } catch (err: any) {
      setAdminLogs(prev => [`EXCEPTION: ${err.message}`, ...prev]);
    } finally {
      setIngesting(false);
    }
  };

  // --- Logic Helpers ---
  const allGenres = Array.from(new Set(mangas.flatMap(m => m.genres || []))).sort();

  const filteredMangas = mangas.filter(m => {
    if (activeTab === "originals") return true; // Show all for home
    if (activeTab === "bookmarks") return bookmarks.includes(m.id);
    if (activeTab === "genres") {
      if (!selectedGenre) return true;
      return m.genres?.includes(selectedGenre);
    }
    return true; // ranking or others
  });

  // --- Real Ranking Analysis ---
  // 1. Hot Ranking: Formula = (Views * 0.7) + (Popularity/Followers * 0.3)
  const sortedByRanking = [...mangas].sort((a: any, b: any) => {
    const scoreA = (a.numericViews || 0) * 0.7 + (a.popularity || 0) * 0.3;
    const scoreB = (b.numericViews || 0) * 0.7 + (b.popularity || 0) * 0.3;
    return scoreB - scoreA;
  });

  // 2. New Updates: Sort by latest chapter date
  const sortedByUpdates = [...mangas].sort((a: any, b: any) => {
    return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
  });

  // Apply sorting for other tabs
  if (activeTab === "ranking") {
    if (sortBy === "popular") {
      filteredMangas.sort((a: any, b: any) => {
        const scoreA = (a.numericViews || 0) * 0.7 + (a.popularity || 0) * 0.3;
        const scoreB = (b.numericViews || 0) * 0.7 + (b.popularity || 0) * 0.3;
        return scoreB - scoreA;
      });
    } else {
      filteredMangas.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  // --- Effects ---
  useEffect(() => {
    // Initial data load from Supabase
    fetchMangas();
    
    // Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdminStatus(session.user.id);
        fetchUserData(session.user.id);
      } else {
        loadLocalData();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkAdminStatus(session.user.id);
        fetchUserData(session.user.id);
      } else {
        setIsAdmin(false);
        loadLocalData();
      }
    });

    // Theme initialization
    const savedTheme = localStorage.getItem("mangify-theme") as Theme;
    if (savedTheme) applyTheme(savedTheme);
    else applyTheme("light");

    return () => subscription.unsubscribe();
  }, []);

  // --- Render ---
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 px-4 md:px-8 lg:px-12 pb-12">
      
      <Navbar 
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isAdmin={isAdmin}
        session={session}
        onLogout={handleLogout}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
          setIsAuthModalOpen(true);
        }}
        activeTheme={activeTheme}
        onApplyTheme={applyTheme}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto">
        {activeTab === "admin" ? (
          <AdminPortal 
            adminInput={adminInput}
            onAdminInputChange={(field, value) => setAdminInput(prev => ({ ...prev, [field]: value }))}
            adminLogs={adminLogs}
            ingesting={ingesting}
            onIngest={handleIngest}
          />
        ) : (
          <>
            {/* Quick Resume Section */}
            <QuickResumeBanner 
              history={history}
              mangas={mangas}
              onLaunchReader={handleLaunchReader}
            />

            {activeTab === "originals" ? (
              <div className="space-y-16">
                {/* 1. Hot Ranking Section */}
                <section>
                  <LibraryGrid 
                    activeTab="ranking"
                    selectedGenre={null}
                    sortBy="popular"
                    filteredMangas={sortedByRanking.slice(0, 10)}
                    bookmarks={bookmarks}
                    allMangas={mangas}
                    onSelectManga={setSelectedMangaInfo}
                    onToggleBookmark={handleToggleBookmark}
                    onTabChange={handleTabChange}
                  />
                </section>

                {/* 2. New Updates Section */}
                <section>
                  <h2 className="prompt-semibold text-xl mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-accent">update</span>
                    มังงะอัปเดตใหม่
                  </h2>
                  <LibraryGrid 
                    activeTab="updates"
                    selectedGenre={null}
                    sortBy="newest"
                    filteredMangas={sortedByUpdates.slice(0, 10)}
                    bookmarks={bookmarks}
                    allMangas={mangas}
                    onSelectManga={setSelectedMangaInfo}
                    onToggleBookmark={handleToggleBookmark}
                    onTabChange={handleTabChange}
                  />
                </section>
              </div>
            ) : (
              <>
                {/* Sub-navigation Filters for Genres Tab */}
                {activeTab === "genres" && (
                  <div className="mb-10 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setSelectedGenre(null)}
                        className={`px-4 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                          selectedGenre === null ? "bg-foreground text-background border-foreground" : "bg-surface border-border opacity-70 hover:opacity-100"
                        }`}
                      >
                        ทั้งหมด
                      </button>
                      {allGenres.map(genre => (
                        <button 
                          key={genre}
                          onClick={() => setSelectedGenre(genre)}
                          className={`px-4 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                            selectedGenre === genre ? "bg-foreground text-background border-foreground" : "bg-surface border-border opacity-70 hover:opacity-100"
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sorting for Ranking Tab */}
                {activeTab === "ranking" && (
                  <div className="mb-8 flex justify-end gap-3 animate-in fade-in duration-500">
                    <button 
                      onClick={() => setSortBy("popular")}
                      className={`text-xs prompt-medium flex items-center gap-1 ${sortBy === "popular" ? "text-accent" : "opacity-50"}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
                      ยอดนิยม
                    </button>
                    <button 
                      onClick={() => setSortBy("alphabetical")}
                      className={`text-xs prompt-medium flex items-center gap-1 ${sortBy === "alphabetical" ? "text-accent" : "opacity-50"}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">sort_by_alpha</span>
                      ตัวอักษร
                    </button>
                  </div>
                )}

                <LibraryGrid 
                  activeTab={activeTab}
                  selectedGenre={selectedGenre}
                  sortBy={sortBy}
                  filteredMangas={filteredMangas}
                  bookmarks={bookmarks}
                  allMangas={mangas}
                  onSelectManga={setSelectedMangaInfo}
                  onToggleBookmark={handleToggleBookmark}
                  onTabChange={handleTabChange}
                />
              </>
            )}
          </>
        )}
      </main>

      {/* Manga Details Modal */}
      {selectedMangaInfo && (
        <MangaInfoModal 
          manga={selectedMangaInfo}
          onClose={() => setSelectedMangaInfo(null)}
          history={history}
          bookmarks={bookmarks}
          onLaunchReader={handleLaunchReader}
          onToggleBookmark={handleToggleBookmark}
        />
      )}

      {/* Reader View Overlay */}
      {isReaderOpen && activeManga && (
        <ReaderOverlay 
          activeManga={activeManga}
          activeChapterId={activeChapterId}
          currentPageIndex={currentPageIndex}
          scrollPercent={scrollPercent}
          readingMode={readingMode}
          showControls={showControls}
          isChapterPanelOpen={isChapterPanelOpen}
          readerContentRef={readerContentRef}
          onClose={handleReaderClose}
          onReaderScroll={handleReaderScroll}
          onToggleControls={() => setShowControls(!showControls)}
          onNavigateHorizontal={handleNavigateHorizontal}
          onLaunchReader={handleLaunchReader}
          onSetReadingMode={setReadingMode}
          onToggleChapterPanel={setIsChapterPanelOpen}
          resetControlsTimeout={resetControlsTimeout}
        />
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        mode={authMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSetMode={setAuthMode}
        email={authEmail}
        onEmailChange={setAuthEmail}
        password={authPassword}
        onPasswordChange={setAuthPassword}
        loading={authLoading}
        error={authError}
        onSubmit={handleAuthSubmit}
      />
    </div>
  );
}
