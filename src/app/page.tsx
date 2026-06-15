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
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [tempSelectedGenres, setTempSelectedGenres] = useState<string[]>([]);

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

  // --- Real Ranking Analysis & Recommendation Helper Functions ---
  const getMangaScore = (m: Manga) => {
    const hasRealInteractions = (m.realViews || 0) > 0 || (m.realBookmarks || 0) > 0;
    if (hasRealInteractions) {
      return (m.realViews || 0) * 0.7 + (m.realBookmarks || 0) * 0.3;
    }
    return (m.numericViews || 0) * 0.7 + (m.popularity || 0) * 0.3;
  };

  const getRecommendedMangas = () => {
    if (!favoriteGenres || favoriteGenres.length === 0) {
      // Fallback: Top 10 most popular overall
      return [...mangas].sort((a, b) => getMangaScore(b) - getMangaScore(a)).slice(0, 10);
    }
    // Filter mangas matching favorite genres
    const matched = mangas.filter(m => 
      m.genres?.some(g => favoriteGenres.includes(g))
    );
    if (matched.length === 0) {
      return [...mangas].sort((a, b) => getMangaScore(b) - getMangaScore(a)).slice(0, 10);
    }
    return matched.sort((a, b) => getMangaScore(b) - getMangaScore(a)).slice(0, 10);
  };

  const handleSaveGenres = (selected: string[]) => {
    setFavoriteGenres(selected);
    localStorage.setItem("mangify-favorite-genres", JSON.stringify(selected));
    localStorage.removeItem("mangify-favorite-genres-skipped");
    setIsGenreModalOpen(false);
  };

  const handleSkipGenres = () => {
    localStorage.setItem("mangify-favorite-genres-skipped", "true");
    setIsGenreModalOpen(false);
  };

  // 1. Hot Ranking: Formula using getMangaScore
  const sortedByRanking = [...mangas].sort((a: any, b: any) => {
    return getMangaScore(b) - getMangaScore(a);
  });

  // 2. New Updates: Sort by latest chapter date
  const sortedByUpdates = [...mangas].sort((a: any, b: any) => {
    return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
  });

  // Apply sorting for other tabs
  if (activeTab === "ranking") {
    if (sortBy === "popular") {
      filteredMangas.sort((a: any, b: any) => getMangaScore(b) - getMangaScore(a));
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

    // Favorite genres initialization
    const savedFavGenres = localStorage.getItem("mangify-favorite-genres");
    const favGenresSkipped = localStorage.getItem("mangify-favorite-genres-skipped");
    if (savedFavGenres) {
      setFavoriteGenres(JSON.parse(savedFavGenres));
    } else if (!favGenresSkipped) {
      setIsGenreModalOpen(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  // Sync tempSelectedGenres when Favorite Genres Modal opens
  useEffect(() => {
    if (isGenreModalOpen) {
      setTempSelectedGenres(favoriteGenres);
    }
  }, [isGenreModalOpen, favoriteGenres]);

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
            {activeTab === "originals" ? (
              <div className="space-y-16">
                {/* Quick Resume Section - Moved here to show only on Home (originals tab) */}
                <QuickResumeBanner 
                  history={history}
                  mangas={mangas}
                  onLaunchReader={handleLaunchReader}
                />

                {/* 1. Recommended for You Section */}
                <section>
                  <LibraryGrid 
                    activeTab="originals"
                    selectedGenre={null}
                    sortBy="popular"
                    filteredMangas={getRecommendedMangas()}
                    bookmarks={bookmarks}
                    allMangas={mangas}
                    onSelectManga={handleSelectManga}
                    onToggleBookmark={handleToggleBookmark}
                    onTabChange={handleTabChange}
                    headerExtra={
                      <button 
                        onClick={() => setIsGenreModalOpen(true)}
                        className="text-xs prompt-semibold flex items-center gap-1 bg-accent/10 text-accent hover:bg-accent hover:text-white px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        ปรับแต่งหมวดหมู่
                      </button>
                    }
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

                {/* Premium Top Tier 1 - 3 Podium Section */}
                {activeTab === "ranking" && sortBy === "popular" && filteredMangas.length >= 3 && (
                  <div className="mb-12 animate-in fade-in slide-in-from-bottom-6 duration-500">
                    {/* Podium layout for md and larger, simple list/cards for mobile */}
                    <div className="hidden md:flex items-end justify-center gap-6 lg:gap-8 max-w-5xl mx-auto pt-6 pb-2">
                      
                      {/* Rank 2 (Silver) */}
                      {(() => {
                        const m = filteredMangas[1];
                        return (
                          <div 
                            onClick={() => handleSelectManga(m)}
                            className="flex-1 max-w-[280px] bg-surface/80 backdrop-blur-sm border border-border/60 hover:border-[#A0A0A0] rounded-2xl p-5 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-2 hover:shadow-xl cursor-pointer group relative"
                          >
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-[#E2E2E2] to-[#B0B0B0] text-black flex items-center justify-center font-bold text-lg border-2 border-background shadow-md">
                              2
                            </div>
                            <div className="w-32 aspect-[2/3] rounded-xl overflow-hidden shadow-md border border-border/20 mb-4 mt-2 relative">
                              <img src={m.cover} alt={m.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            </div>
                            <h3 className="prompt-bold text-sm line-clamp-1 group-hover:text-accent transition-colors">
                              {m.title}
                            </h3>
                            <p className="prompt-light text-xs opacity-60 mt-0.5">{m.author}</p>
                            <div className="flex items-center gap-3 mt-3 px-3 py-1.5 bg-border/20 rounded-full text-[11px] prompt-medium opacity-90">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-[#A0A0A0]">visibility</span>
                                {m.realViews || 0}
                              </span>
                              <span className="w-px h-3 bg-border" />
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-accent">bookmark</span>
                                {m.realBookmarks || 0}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Rank 1 (Gold) */}
                      {(() => {
                        const m = filteredMangas[0];
                        return (
                          <div 
                            onClick={() => handleSelectManga(m)}
                            className="flex-1 max-w-[300px] bg-surface border-2 border-[#FFD700] hover:border-[#FFD700]/80 rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-3 hover:shadow-2xl hover:shadow-[#FFD700]/10 cursor-pointer group relative scale-105 z-10"
                          >
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center">
                              <span className="material-symbols-outlined text-[#FFD700] text-[28px] drop-shadow animate-bounce">crown</span>
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFE033] to-[#FFB900] text-black flex items-center justify-center font-bold text-xl border-2 border-background shadow-lg -mt-1.5">
                                1
                              </div>
                            </div>
                            <div className="w-36 aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-border/20 mb-4 mt-4 relative">
                              <img src={m.cover} alt={m.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            </div>
                            <h3 className="prompt-bold text-base line-clamp-1 group-hover:text-accent transition-colors">
                              {m.title}
                            </h3>
                            <p className="prompt-light text-xs opacity-60 mt-0.5">{m.author}</p>
                            <div className="flex items-center gap-3 mt-3 px-4 py-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full text-xs prompt-semibold text-foreground/90">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-[#FFD700] fill">visibility</span>
                                {m.realViews || 0}
                              </span>
                              <span className="w-px h-3 bg-[#FFD700]/20" />
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-accent fill">bookmark</span>
                                {m.realBookmarks || 0}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Rank 3 (Bronze) */}
                      {(() => {
                        const m = filteredMangas[2];
                        return (
                          <div 
                            onClick={() => handleSelectManga(m)}
                            className="flex-1 max-w-[280px] bg-surface/80 backdrop-blur-sm border border-border/60 hover:border-[#CD7F32] rounded-2xl p-5 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-2 hover:shadow-xl cursor-pointer group relative"
                          >
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-[#D27D2D] to-[#995511] text-white flex items-center justify-center font-bold text-lg border-2 border-background shadow-md">
                              3
                            </div>
                            <div className="w-32 aspect-[2/3] rounded-xl overflow-hidden shadow-md border border-border/20 mb-4 mt-2 relative">
                              <img src={m.cover} alt={m.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            </div>
                            <h3 className="prompt-bold text-sm line-clamp-1 group-hover:text-accent transition-colors">
                              {m.title}
                            </h3>
                            <p className="prompt-light text-xs opacity-60 mt-0.5">{m.author}</p>
                            <div className="flex items-center gap-3 mt-3 px-3 py-1.5 bg-border/20 rounded-full text-[11px] prompt-medium opacity-90">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-[#CD7F32]">visibility</span>
                                {m.realViews || 0}
                              </span>
                              <span className="w-px h-3 bg-border" />
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-accent">bookmark</span>
                                {m.realBookmarks || 0}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                    </div>

                    {/* Mobile list view for Top 3 */}
                    <div className="flex flex-col gap-4 md:hidden">
                      {filteredMangas.slice(0, 3).map((m, idx) => {
                        const colors = [
                          { bg: "bg-[#FFD700]/10", border: "border-[#FFD700]", text: "text-[#FFD700]", label: "1" },
                          { bg: "bg-surface", border: "border-border/80", text: "text-[#A0A0A0]", label: "2" },
                          { bg: "bg-surface", border: "border-border/80", text: "text-[#CD7F32]", label: "3" },
                        ][idx];
                        return (
                          <div 
                            key={m.id}
                            onClick={() => handleSelectManga(m)}
                            className={`flex items-center gap-4 p-4 rounded-xl border ${colors.border} ${colors.bg} cursor-pointer group`}
                          >
                            <div className={`w-8 h-8 rounded-full ${colors.text} flex items-center justify-center font-bold text-base border border-current shadow-sm`}>
                              {colors.label}
                            </div>
                            <div className="w-12 aspect-[2/3] rounded overflow-hidden border border-border/20 relative">
                              <img src={m.cover} alt={m.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="prompt-bold text-sm truncate group-hover:text-accent transition-colors">{m.title}</h3>
                              <p className="prompt-light text-xs opacity-60 mt-0.5">{m.author}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] prompt-medium opacity-80">
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px] opacity-75">visibility</span>
                                  {m.realViews || 0}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px] text-accent">bookmark</span>
                                  {m.realBookmarks || 0}
                                </span>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-[20px] opacity-40 group-hover:opacity-100 transition-opacity">chevron_right</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <LibraryGrid 
                  activeTab={activeTab}
                  selectedGenre={selectedGenre}
                  sortBy={sortBy}
                  filteredMangas={(activeTab === "ranking" && sortBy === "popular") ? filteredMangas.slice(3) : filteredMangas}
                  bookmarks={bookmarks}
                  allMangas={filteredMangas}
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

      {/* Favorite Genres Modal */}
      {isGenreModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1800] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={handleSkipGenres}
        >
          {/* Modal Box */}
          <div 
            className="relative w-full max-w-xl bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden p-6 md:p-8 animate-in fade-in zoom-in-95 slide-in-from-bottom-10 duration-300 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="prompt-bold text-xl md:text-2xl text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent text-[28px]">auto_awesome</span>
                  เลือกหมวดหมู่ที่คุณชื่นชอบ
                </h3>
                <p className="prompt-light text-xs opacity-70 mt-1">
                  เลือกหมวดหมู่มังงะที่คุณสนใจอย่างน้อย 1-3 หมวดหมู่ เพื่อให้เราสามารถแนะนำเรื่องที่ใช่สำหรับคุณได้ดียิ่งขึ้น
                </p>
              </div>
              <button 
                onClick={handleSkipGenres}
                className="p-1.5 rounded-full hover:bg-border/40 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Genre Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1 mb-8 custom-scrollbar">
              {allGenres.map(genre => {
                const isSelected = tempSelectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => {
                      setTempSelectedGenres(prev => 
                        prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
                      );
                    }}
                    className={`px-4 py-3 rounded-xl text-xs prompt-semibold border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected 
                        ? "bg-accent/10 border-accent text-accent shadow-sm" 
                        : "bg-surface border-border/60 text-foreground opacity-75 hover:opacity-100 hover:border-border"
                    }`}
                  >
                    <span>{genre}</span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[14px] text-accent fill animate-in zoom-in duration-200">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-5">
              <button
                onClick={handleSkipGenres}
                className="px-5 py-2.5 rounded-xl text-xs prompt-medium text-foreground hover:bg-border/20 transition-all cursor-pointer"
              >
                ข้ามไปก่อน
              </button>
              <button
                onClick={() => handleSaveGenres(tempSelectedGenres)}
                disabled={tempSelectedGenres.length === 0}
                className="px-6 py-2.5 rounded-xl text-xs prompt-bold bg-accent text-white hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-accent/20"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                บันทึกความชอบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
