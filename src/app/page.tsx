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
  const [historyList, setHistoryList] = useState<ReadingProgress[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Keep active history (banner) in sync with the latest item in the history list
  useEffect(() => {
    setHistory(historyList[0] || null);
  }, [historyList]);
  
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
  const isTransitioningChapterRef = useRef(false);

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

  const logEvent = async (eventType: string, metadata: any = {}) => {
    const localUid = userId || localStorage.getItem("mangify-user-id") || "";
    if (!localUid) return;
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      await fetch("/api/logs", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId: localUid, eventType, metadata })
      });
    } catch (err) {
      console.error(`Failed to log event ${eventType}:`, err);
    }
  };

  const handleSelectManga = (manga: Manga | null) => {
    setSelectedMangaInfo(manga);
    if (manga) {
      logEvent("manga_view", { manga_id: manga.id });
    }
  };

  const fetchUserData = async (targetUserId: string, token: string | null = null) => {
    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Fetch Progress
      const pRes = await fetch(`/api/sync/progress?userId=${targetUserId}`, { headers });
      const pData = await pRes.json();
      if (pData.progress && pData.progress.length > 0) {
        const mappedList = pData.progress.map((item: any) => ({
          mangaId: item.manga_id,
          chapterId: item.chapter_id,
          pageIndex: item.page_index,
          scrollPercent: item.scroll_percent
        }));
        setHistoryList(mappedList);
      } else {
        // Fallback to localStorage if empty
        const localHistory = localStorage.getItem("mangify-history-list");
        if (localHistory) {
          setHistoryList(JSON.parse(localHistory));
        } else {
          const legacyHistory = localStorage.getItem("mangify-history");
          if (legacyHistory) setHistoryList([JSON.parse(legacyHistory)]);
        }
      }

      // Fetch Bookmarks
      const bRes = await fetch(`/api/sync/bookmarks?userId=${targetUserId}`, { headers });
      const bData = await bRes.json();
      if (bData.bookmarks) {
        setBookmarks(bData.bookmarks.map((b: any) => b.manga_id));
      } else {
        const localBookmarks = localStorage.getItem("mangify-bookmarks");
        if (localBookmarks) setBookmarks(JSON.parse(localBookmarks));
      }
    } catch (err) {
      console.error("Sync error:", err);
      loadLocalData();
    }
  };

  const loadLocalData = () => {
    const localHistory = localStorage.getItem("mangify-history-list");
    if (localHistory) {
      setHistoryList(JSON.parse(localHistory));
    } else {
      const legacyHistory = localStorage.getItem("mangify-history");
      if (legacyHistory) setHistoryList([JSON.parse(legacyHistory)]);
    }
    
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
    const isAdding = !bookmarks.includes(mangaId);
    if (isAdding) {
      newBookmarks.push(mangaId);
    } else {
      newBookmarks = newBookmarks.filter(id => id !== mangaId);
    }
    setBookmarks(newBookmarks);
    localStorage.setItem("mangify-bookmarks", JSON.stringify(newBookmarks));

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    try {
      if (isAdding) {
        await fetch("/api/sync/bookmarks", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId, mangaId })
        });
      } else {
        await fetch(`/api/sync/bookmarks?userId=${userId}&mangaId=${mangaId}`, {
          method: "DELETE",
          headers
        });
      }
      logEvent("bookmark_toggle", { manga_id: mangaId, action: isAdding ? "add" : "remove" });
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  };

  const handleLaunchReader = (manga: Manga, chapterId: string, pageIndex = 0, scrollPct = 0) => {
    isTransitioningChapterRef.current = true;
    setActiveManga(manga);
    setActiveChapterId(chapterId);
    setCurrentPageIndex(pageIndex);
    setScrollPercent(scrollPct);
    setIsReaderOpen(true);
    resetControlsTimeout();
    
    // Log chapter read event
    logEvent("chapter_read", { manga_id: manga.id, chapter_id: chapterId });

    // Auto-scroll logic if vertical
    if (readingMode === "vertical") {
      // Instantly try to reset scroll to top to prevent double scroll events
      if (readerContentRef.current && scrollPct === 0) {
        readerContentRef.current.scrollTop = 0;
      }
      setTimeout(() => {
        if (readerContentRef.current) {
          if (scrollPct > 0) {
            const totalHeight = readerContentRef.current.scrollHeight;
            readerContentRef.current.scrollTop = (scrollPct / 100) * totalHeight;
          } else {
            readerContentRef.current.scrollTop = 0;
          }
        }
        // Release transitioning lock after DOM has stabilized
        setTimeout(() => {
          isTransitioningChapterRef.current = false;
        }, 50);
      }, 100);
    } else {
      isTransitioningChapterRef.current = false;
    }
  };

  const handleReaderClose = () => {
    setIsReaderOpen(false);
    setActiveManga(null);
    setShowControls(true);
    isTransitioningChapterRef.current = false;
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
    if (!readerContentRef.current || readingMode !== "vertical" || isTransitioningChapterRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = readerContentRef.current;
    if (scrollHeight <= clientHeight) return;

    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setScrollPercent(progress);
    
    debouncedSyncProgress(progress, 0);

    // Auto-load next chapter when scrolled to the very bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    if (isAtBottom && activeManga && activeChapterId) {
      const curIdx = activeManga.chapters.findIndex(c => c.id === activeChapterId);
      if (curIdx < activeManga.chapters.length - 1) {
        const nextCh = activeManga.chapters[curIdx + 1];
        handleLaunchReader(activeManga, nextCh.id, 0, 0);
      }
    }
  };

  const debouncedSyncProgress = (scroll: number, page: number) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      if (!activeManga || !activeChapterId) return;
      
      const progress: ReadingProgress = {
        mangaId: activeManga.id,
        chapterId: activeChapterId,
        pageIndex: page,
        scrollPercent: scroll
      };
      
      setHistoryList(prev => {
        const filtered = prev.filter(p => p.mangaId !== progress.mangaId);
        const updated = [progress, ...filtered];
        localStorage.setItem("mangify-history-list", JSON.stringify(updated));
        localStorage.setItem("mangify-history", JSON.stringify(progress));
        return updated;
      });

      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      try {
        await fetch("/api/sync/progress", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId, ...progress })
        });
      } catch (err) {
        console.error("Failed to sync progress:", err);
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

  const syncAnonymousDataToUser = async (authUserId: string, token: string) => {
    // 1. Sync bookmarks
    const localBookmarks = localStorage.getItem("mangify-bookmarks");
    const bookmarksToSync = localBookmarks ? JSON.parse(localBookmarks) : bookmarks;
    for (const mangaId of bookmarksToSync) {
      try {
        await fetch("/api/sync/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: authUserId, mangaId }),
        });
      } catch (e) {
        console.error("Failed to sync bookmark to cloud:", mangaId, e);
      }
    }

    // 2. Sync reading history
    const localHistoryList = localStorage.getItem("mangify-history-list");
    const historyToSync = localHistoryList ? JSON.parse(localHistoryList) : historyList;
    for (const progress of historyToSync) {
      try {
        await fetch("/api/sync/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: authUserId, ...progress }),
        });
      } catch (e) {
        console.error("Failed to sync progress to cloud:", progress.mangaId, e);
      }
    }
  };

  // --- Effects ---
  useEffect(() => {
    // Initial data load from Supabase
    fetchMangas();
    
    // Load or generate anonymous ID
    let anonId = localStorage.getItem("mangify-user-id");
    if (!anonId) {
      const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      anonId = `anon-${randomPart}`;
      localStorage.setItem("mangify-user-id", anonId);
    }
    setUserId(anonId);

    // Auth Listener
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserId(session.user.id);
        checkAdminStatus(session.user.id);
        await fetchUserData(session.user.id, session.access_token);
      } else {
        await fetchUserData(anonId, null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session) {
        setUserId(session.user.id);
        checkAdminStatus(session.user.id);
        
        if (event === "SIGNED_IN") {
          await syncAnonymousDataToUser(session.user.id, session.access_token);
          // Clean local storage anonymous keys to avoid re-syncing next time
          localStorage.removeItem("mangify-bookmarks");
          localStorage.removeItem("mangify-history-list");
          localStorage.removeItem("mangify-history");

          // Log login action
          fetch("/api/logs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ userId: session.user.id, eventType: "auth_action", metadata: { action: "login" } })
          }).catch(console.error);
        }
        await fetchUserData(session.user.id, session.access_token);
      } else {
        setIsAdmin(false);
        setUserId(anonId);
        await fetchUserData(anonId, null);
        
        if (event === "SIGNED_OUT") {
          fetch("/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: anonId, eventType: "auth_action", metadata: { action: "logout" } })
          }).catch(console.error);
        }
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
                    onSelectManga={handleSelectManga}
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
                    onSelectManga={handleSelectManga}
                    onToggleBookmark={handleToggleBookmark}
                    onTabChange={handleTabChange}
                  />
                </section>
              </div>
            ) : activeTab === "history" ? (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8 border-b border-border/50 pb-4">
                  <h2 className="prompt-semibold text-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-[24px] text-accent">history</span>
                    ประวัติการอ่านของฉัน
                  </h2>
                  {historyList.length > 0 && (
                    <button 
                      onClick={() => {
                        if (confirm("คุณต้องการล้างประวัติการอ่านทั้งหมดใช่หรือไม่?")) {
                          setHistoryList([]);
                          localStorage.removeItem("mangify-history-list");
                          localStorage.removeItem("mangify-history");
                          
                          const headers: HeadersInit = {};
                          if (session?.access_token) {
                            headers["Authorization"] = `Bearer ${session.access_token}`;
                          }
                          fetch(`/api/sync/progress?userId=${userId}`, {
                            method: "DELETE",
                            headers
                          }).catch(console.error);
                        }
                      }}
                      className="text-xs prompt-medium text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                      ล้างประวัติทั้งหมด
                    </button>
                  )}
                </div>

                {historyList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                    {historyList.map(item => {
                      const manga = mangas.find(m => m.id === item.mangaId);
                      if (!manga) return null;
                      const chapter = manga.chapters.find(ch => ch.id === item.chapterId);
                      return (
                        <div 
                          key={item.mangaId}
                          onClick={() => handleSelectManga(manga)}
                          className="group border border-border/60 bg-surface rounded-xl p-4 flex gap-4 hover:border-accent hover:shadow-md transition-all duration-300 cursor-pointer"
                        >
                          {/* Manga Cover */}
                          <div className="w-16 h-22 rounded-lg overflow-hidden flex-shrink-0 border border-border/20 shadow-sm relative">
                            <img src={manga.cover} alt={manga.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          </div>
                          
                          {/* Manga Info & Progress */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div>
                              <h3 className="prompt-semibold text-sm truncate group-hover:text-accent transition-colors">
                                {manga.title}
                              </h3>
                              <p className="prompt-light text-[11px] opacity-60 mt-0.5">โดย {manga.author}</p>
                            </div>
                            
                            <div className="mt-2">
                              <p className="prompt-medium text-xs text-accent truncate">
                                {chapter?.title || "ตอนล่าสุด"}
                              </p>
                              {/* Progress bar */}
                              <div className="w-full h-1 bg-border/80 rounded-full mt-1.5 overflow-hidden">
                                <div 
                                  className="h-full bg-accent rounded-full transition-all duration-500" 
                                  style={{ width: `${item.scrollPercent}%` }}
                                />
                              </div>
                              <p className="prompt-light text-[10px] opacity-50 mt-1">
                                อ่านค้างไว้: {Math.round(item.scrollPercent)}%
                              </p>
                            </div>
                          </div>
                          
                          {/* Resume Button */}
                          <div className="flex items-center">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLaunchReader(manga, item.chapterId, item.pageIndex, item.scrollPercent);
                              }}
                              className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center hover:bg-accent hover:text-white transition-all cursor-pointer shadow-sm group-hover:scale-105"
                              title="อ่านต่อ"
                            >
                              <span className="material-symbols-outlined text-[16px] fill">play_arrow</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/60 rounded-xl mb-16">
                    <span className="material-symbols-outlined text-[40px] opacity-40 mb-3">history</span>
                    <p className="prompt-medium text-lg opacity-70">ไม่มีประวัติการอ่านที่บันทึกไว้</p>
                    <button 
                      onClick={() => handleTabChange("originals")}
                      className="mt-3 text-xs prompt-medium text-accent hover:underline cursor-pointer"
                    >
                      กลับหน้าหลักเพื่อเลือกมังงะ
                    </button>
                  </div>
                )}
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
                  onSelectManga={handleSelectManga}
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
          onClose={() => handleSelectManga(null)}
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
