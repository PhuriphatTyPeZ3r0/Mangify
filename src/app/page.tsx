"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  ChevronLeft, 
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Menu, 
  X, 
  TrendingUp, 
  Filter, 
  Sparkles,
  Layers,
  Bookmark,
  User,
  Lock,
  UploadCloud,
  FileArchive,
  LogOut,
  Plus,
  Loader2,
  Shield
} from "lucide-react";
import { demoManga as initialManga } from "../data/mangaData";
import { Manga, Theme, ReadingMode, ReadingProgress } from "../types";
import JSZip from "jszip";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [mangas, setMangas] = useState<Manga[]>(initialManga);
  const [activeTheme, setActiveTheme] = useState<Theme>("light");
  const [history, setHistory] = useState<ReadingProgress | null>(null);

  // Navbar and Filter States
  const [activeTab, setActiveTab] = useState<string>("originals");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "popular" | "alphabetical">("default");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>("");
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Auth States
  const [session, setSession] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Ingestion States
  const [adminMangaId, setAdminMangaId] = useState<string>("");
  const [adminChapterId, setAdminChapterId] = useState<string>("");
  const [adminChapterTitle, setAdminChapterTitle] = useState<string>("");
  const [adminZipUrl, setAdminZipUrl] = useState<string>("");
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Local ZIP Reader States
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [localReaderLoading, setLocalReaderLoading] = useState<boolean>(false);
  const [localBlobs, setLocalBlobs] = useState<string[]>([]);

  // Reader States
  const [activeManga, setActiveManga] = useState<Manga | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>("");
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [scrollPercent, setScrollPercent] = useState<number>(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>("vertical");
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isChapterPanelOpen, setIsChapterPanelOpen] = useState<boolean>(false);

  const readerContentRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedProgressRef = useRef<{ chapterId: string; pageIndex: number; scrollPercent: number } | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load theme, history, bookmarks, and catalog on mount
  useEffect(() => {
    // Initialize user ID
    let savedUserId = localStorage.getItem("mangify-user-id");
    if (!savedUserId) {
      const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      savedUserId = `anon-${randomPart}`;
      localStorage.setItem("mangify-user-id", savedUserId);
    }
    setUserId(savedUserId);

    // Fetch bookmarks helper
    const fetchBookmarksForUser = async (uid: string, token?: string) => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(`/api/sync/bookmarks?userId=${uid}`, { headers });
        const data = await res.json();
        if (data.bookmarks) {
          setBookmarks(data.bookmarks.map((b: any) => b.manga_id));
        }
      } catch (err) {
        console.error("Failed to fetch bookmarks:", err);
      }
    };

    // Fetch catalog from database
    const fetchCatalog = async () => {
      try {
        const res = await fetch("/api/catalog");
        const data = await res.json();
        if (data.mangas && data.mangas.length > 0) {
          setMangas(data.mangas);
        }
      } catch (err) {
        console.error("Failed to fetch catalog:", err);
      }
    };
    fetchCatalog();

    // Get current session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        setUserId(currentSession.user.id);
        fetchBookmarksForUser(currentSession.user.id, currentSession.access_token);
      } else {
        fetchBookmarksForUser(savedUserId);
      }
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        setUserId(currentSession.user.id);
        fetchBookmarksForUser(currentSession.user.id, currentSession.access_token);
      } else {
        const localUid = localStorage.getItem("mangify-user-id") || savedUserId;
        setUserId(localUid);
        fetchBookmarksForUser(localUid);
      }
    });

    const savedTheme = localStorage.getItem("mangify-theme") as Theme;
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      applyTheme("light");
    }

    const savedHistory = localStorage.getItem("mangify-history");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync theme class to document body
  const applyTheme = (theme: Theme) => {
    setActiveTheme(theme);
    localStorage.setItem("mangify-theme", theme);
    document.body.className = `theme-${theme}`;
  };

  // Save progress to localStorage & Queue sync
  const saveProgress = (mangaId: string, chapterId: string, pageIndex: number, percent: number) => {
    const progress: ReadingProgress = {
      mangaId,
      chapterId,
      pageIndex,
      scrollPercent: percent
    };
    localStorage.setItem("mangify-history", JSON.stringify(progress));
    setHistory(progress);
    queueSyncProgress(mangaId, chapterId, pageIndex, percent);
  };

  const queueSyncProgress = (mangaId: string, chapterId: string, pageIndex: number, percent: number) => {
    if (syncTimeoutRef.current) return;

    syncTimeoutRef.current = setTimeout(async () => {
      syncTimeoutRef.current = null;

      const lastSynced = lastSyncedProgressRef.current;
      if (
        lastSynced && 
        lastSynced.chapterId === chapterId && 
        lastSynced.pageIndex === pageIndex && 
        Math.abs(lastSynced.scrollPercent - percent) < 2
      ) {
        return;
      }

      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        await fetch("/api/sync/progress", {
          method: "POST",
          headers,
          body: JSON.stringify({
            userId,
            mangaId,
            chapterId,
            pageIndex,
            scrollPercent: percent,
          }),
        });
        
        lastSyncedProgressRef.current = { chapterId, pageIndex, scrollPercent: percent };
      } catch (err) {
        console.error("Failed to sync progress to cloud:", err);
      }
    }, 10000);
  };

  const syncProgressImmediately = async (mangaId: string, chapterId: string, pageIndex: number, percent: number) => {
    if (!userId) return;
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      await fetch("/api/sync/progress", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          mangaId,
          chapterId,
          pageIndex,
          scrollPercent: percent,
        }),
      });
      lastSyncedProgressRef.current = { chapterId, pageIndex, scrollPercent: percent };
    } catch (err) {
      console.error("Failed to sync progress immediately:", err);
    }
  };

  const toggleBookmark = async (e: React.MouseEvent, mangaId: string) => {
    e.stopPropagation();
    if (!userId) return;

    const isBookmarked = bookmarks.includes(mangaId);
    const newBookmarks = isBookmarked
      ? bookmarks.filter(id => id !== mangaId)
      : [...bookmarks, mangaId];

    setBookmarks(newBookmarks);

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      if (isBookmarked) {
        await fetch(`/api/sync/bookmarks?userId=${userId}&mangaId=${mangaId}`, {
          method: "DELETE",
          headers,
        });
      } else {
        await fetch("/api/sync/bookmarks", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId, mangaId }),
        });
      }
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
      setBookmarks(bookmarks); // revert on error
    }
  };

  // Sync local bookmarks to authenticated user account on login
  const syncBookmarksToUser = async (userSession: any) => {
    const userToken = userSession.access_token;
    const authUserId = userSession.user.id;

    // Loop through existing bookmarks state and post them to user profile
    for (const mangaId of bookmarks) {
      try {
        await fetch("/api/sync/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
          },
          body: JSON.stringify({
            userId: authUserId,
            mangaId
          })
        });
      } catch (e) {
        console.error("Failed to sync bookmark to cloud:", mangaId, e);
      }
    }

    // Refetch the complete list of bookmarks under the user profile
    try {
      const res = await fetch(`/api/sync/bookmarks?userId=${authUserId}`, {
        headers: {
          "Authorization": `Bearer ${userToken}`
        }
      });
      const data = await res.json();
      if (data.bookmarks) {
        setBookmarks(data.bookmarks.map((b: any) => b.manga_id));
      }
    } catch (err) {
      console.error("Failed to refetch bookmarks after login:", err);
    }
  };

  // Handle Auth login/signup submission
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });

        if (error) throw error;
        
        if (data.session) {
          await syncBookmarksToUser(data.session);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        });

        if (error) throw error;
        
        if (data.session) {
          await syncBookmarksToUser(data.session);
        } else {
          // If email verification is enabled, session might be null.
          alert("สมัครสมาชิกสำเร็จ! โปรดตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี");
        }
      }

      setIsAuthModalOpen(false);
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err.message || "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle user logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Reset user state to anonymous ID
      const savedUserId = localStorage.getItem("mangify-user-id");
      if (savedUserId) {
        setUserId(savedUserId);
      }
      setSession(null);
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  // Handle Admin Portal Ingestion submission
  const handleAdminIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminSuccess(null);
    setAdminError(null);

    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mangaId: adminMangaId.trim(),
          chapterId: adminChapterId.trim(),
          chapterTitle: adminChapterTitle.trim(),
          zipUrl: adminZipUrl.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger ingestion pipeline.");
      }

      setAdminSuccess(`ส่งเรื่องขอจัดเก็บข้อมูลสำเร็จ! คิวสำหรับมังงะ ${adminMangaId} (ตอน: ${adminChapterId}) ได้รับการส่งไปยัง GitHub Actions แล้ว`);
      setAdminMangaId("");
      setAdminChapterId("");
      setAdminChapterTitle("");
      setAdminZipUrl("");
    } catch (err: any) {
      setAdminError(err.message || "เกิดข้อผิดพลาดในการรันขั้นตอน Ingestion");
    } finally {
      setAdminLoading(false);
    }
  };

  // Local ZIP/CBZ processing via JSZip
  const handleLocalZipFile = async (file: File) => {
    setLocalReaderLoading(true);
    try {
      // Clean up previous blob URLs if any exist
      if (localBlobs.length > 0) {
        localBlobs.forEach(url => URL.revokeObjectURL(url));
        setLocalBlobs([]);
      }

      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      
      // Filter out directories and non-images
      const imageFiles = Object.keys(loadedZip.files).filter((name) => {
        const fileObj = loadedZip.files[name];
        return !fileObj.dir && /\.(png|jpe?g|webp|gif|bmp)$/i.test(name) && !name.includes("__MACOSX");
      });

      if (imageFiles.length === 0) {
        alert("ไม่พบไฟล์รูปภาพใน ZIP/CBZ นี้");
        setLocalReaderLoading(false);
        return;
      }

      // Natural sort by filename
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      imageFiles.sort((a, b) => collator.compare(a, b));

      // Extract images as Blob URLs
      const blobUrls: string[] = [];
      for (const name of imageFiles) {
        const imageBlob = await loadedZip.files[name].async("blob");
        const url = URL.createObjectURL(imageBlob);
        blobUrls.push(url);
      }

      setLocalBlobs(blobUrls);

      const localManga: Manga = {
        id: `local-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""), // strip extension
        author: "ไฟล์ในเครื่อง (Local Reader)",
        cover: blobUrls[0] || "",
        description: `ขนาดไฟล์: ${(file.size / (1024 * 1024)).toFixed(2)} MB, จำนวนหน้า: ${blobUrls.length} หน้า`,
        chapters: [
          {
            id: "local-chapter",
            title: "บทหลัก (Local)",
            pages: blobUrls
          }
        ],
        isOriginal: false
      };

      setLocalReaderLoading(false);
      launchReader(localManga, "local-chapter", 0, 0);

    } catch (err) {
      console.error("Failed to parse local zip/cbz file:", err);
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์ ZIP/CBZ");
      setLocalReaderLoading(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".zip") || file.name.endsWith(".cbz"))) {
      handleLocalZipFile(file);
    }
  };

  // Handle Select Manga Card
  const handleSelectManga = (manga: Manga) => {
    const firstChapterId = manga.chapters[0].id;
    if (history && history.mangaId === manga.id) {
      launchReader(manga, history.chapterId, history.pageIndex, history.scrollPercent);
    } else {
      launchReader(manga, firstChapterId, 0, 0);
    }
  };

  // Launch Reader
  const launchReader = (manga: Manga, chapterId: string, pageIndex = 0, scrollPct = 0) => {
    setActiveManga(manga);
    setActiveChapterId(chapterId);
    setCurrentPageIndex(pageIndex);
    setScrollPercent(scrollPct);
    setShowControls(true);

    // Lock scrolling on page background
    document.body.style.overflow = "hidden";

    // Auto fade controls after 3 seconds
    resetControlsTimeout();

    // Scroll to position if vertical
    if (readingMode === "vertical") {
      setTimeout(() => {
        if (readerContentRef.current) {
          const container = readerContentRef.current;
          const scrollHeight = container.scrollHeight - container.clientHeight;
          container.scrollTop = scrollHeight * (scrollPct / 100);
        }
      }, 150);
    }
  };

  // Close Reader
  const handleCloseReader = () => {
    if (activeManga && activeChapterId) {
      if (!activeManga.id.startsWith("local-")) {
        saveProgress(activeManga.id, activeChapterId, currentPageIndex, scrollPercent);
        syncProgressImmediately(activeManga.id, activeChapterId, currentPageIndex, scrollPercent);
      }
    }
    setActiveManga(null);
    document.body.style.overflow = "";
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    // Revoke any local ZIP blobs on reader close to prevent memory leaks
    if (localBlobs.length > 0) {
      localBlobs.forEach(url => URL.revokeObjectURL(url));
      setLocalBlobs([]);
    }
  };

  // Timer logic to auto-hide reader controls
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Keyboard navigation inside reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeManga) return;
      if (e.key === "Escape") {
        handleCloseReader();
      } else if (e.key === "ArrowLeft") {
        if (readingMode === "horizontal") navigateHorizontalPage(-1);
      } else if (e.key === "ArrowRight" || e.key === " ") {
        if (readingMode === "horizontal") navigateHorizontalPage(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeManga, activeChapterId, currentPageIndex, readingMode]);

  // Navigate Horizontal Page
  const navigateHorizontalPage = (direction: number) => {
    if (!activeManga || !activeChapterId) return;
    const chapter = activeManga.chapters.find(ch => ch.id === activeChapterId);
    if (!chapter) return;

    const newIndex = currentPageIndex + direction;
    if (newIndex >= 0 && newIndex < chapter.pages.length) {
      setCurrentPageIndex(newIndex);
      const percent = ((newIndex + 1) / chapter.pages.length) * 100;
      setScrollPercent(percent);
      saveProgress(activeManga.id, activeChapterId, newIndex, percent);
      resetControlsTimeout();
    } else if (newIndex >= chapter.pages.length) {
      const currentIdx = activeManga.chapters.findIndex(ch => ch.id === activeChapterId);
      if (currentIdx < activeManga.chapters.length - 1) {
        const nextChId = activeManga.chapters[currentIdx + 1].id;
        launchReader(activeManga, nextChId, 0, 0);
      } else {
        handleCloseReader();
      }
    } else if (newIndex < 0) {
      const currentIdx = activeManga.chapters.findIndex(ch => ch.id === activeChapterId);
      if (currentIdx > 0) {
        const prevCh = activeManga.chapters[currentIdx - 1];
        launchReader(activeManga, prevCh.id, prevCh.pages.length - 1, 100);
      }
    }
  };

  // Reader Scroll Tracking (Vertical scroll mode)
  const handleReaderScroll = () => {
    if (readingMode !== "vertical" || !activeManga || !activeChapterId || !readerContentRef.current) return;
    const container = readerContentRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    
    setScrollPercent(percent);
    saveProgress(activeManga.id, activeChapterId, 0, percent);

    if (percent > 99.5) {
      const currentIdx = activeManga.chapters.findIndex(ch => ch.id === activeChapterId);
      if (currentIdx < activeManga.chapters.length - 1) {
        const nextChId = activeManga.chapters[currentIdx + 1].id;
        launchReader(activeManga, nextChId, 0, 0);
      }
    }
  };

  // Tab navigation functions
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Close drawer on link click
    // Reset secondary filters when switching main tabs
    if (tab !== "genres") setSelectedGenre(null);
    if (tab !== "ranking") setSortBy("default");
  };

  // Helper variables for Quick Resume banner
  const resumeManga = history ? mangas.find(m => m.id === history.mangaId) : null;
  const resumeChapter = resumeManga?.chapters.find(ch => ch.id === history?.chapterId) || resumeManga?.chapters[0];

  const currentChapter = activeManga?.chapters.find(ch => ch.id === activeChapterId);
  const currentChapterIdx = activeManga && activeChapterId
    ? activeManga.chapters.findIndex(ch => ch.id === activeChapterId)
    : -1;

  // Get all unique genres in current mangas dataset
  const allGenres = Array.from(new Set(mangas.flatMap(m => m.genres || [])));

  // Filtered & Sorted manga grid logic
  const filteredMangas = mangas
    .filter((manga) => {
      // 1. Main Tab filters
      if (activeTab === "originals") {
        return manga.isOriginal === true;
      }
      if (activeTab === "canvas") {
        return manga.isOriginal === false;
      }
      if (activeTab === "bookmarks") {
        return bookmarks.includes(manga.id);
      }
      // If "genres" or "ranking" tab is active, we display all mangas and apply secondary filters
      return true;
    })
    .filter((manga) => {
      // 2. Secondary Genre filter (only active on "genres" tab)
      if (activeTab === "genres" && selectedGenre) {
        return manga.genres?.includes(selectedGenre);
      }
      return true;
    })
    .sort((a, b) => {
      // 3. Sorting (only active on "ranking" tab)
      if (activeTab === "ranking") {
        if (sortBy === "popular") {
          return (b.popularity || 0) - (a.popularity || 0);
        }
        if (sortBy === "alphabetical") {
          return a.title.localeCompare(b.title);
        }
      }
      return 0; // Maintain default data order
    });

  return (
    <div 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
      className="flex-1 w-full max-w-5xl mx-auto px-6 py-6 flex flex-col min-h-screen relative"
    >
      
      {/* Premium Webtoon-Style Navigation Bar */}
      <nav className="flex justify-between items-center py-4 mb-8 border-b border-border transition-colors relative">
        {/* Left Side: Logo & Menu links */}
        <div className="flex items-center gap-10">
          <button 
            onClick={() => handleTabChange("originals")}
            className="prompt-bold text-3xl tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent hover:opacity-90 cursor-pointer"
          >
            Mangify
          </button>
          
          {/* Desktop Navigation Links */}
          <ul className="hidden md:flex items-center gap-6 text-sm font-medium prompt-regular">
            <li>
              <button 
                onClick={() => handleTabChange("originals")}
                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${
                  activeTab === "originals" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                ออริจินัล
                {activeTab === "originals" && (
                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
                )}
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleTabChange("genres")}
                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${
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
                onClick={() => handleTabChange("ranking")}
                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${
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
                onClick={() => handleTabChange("canvas")}
                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${
                  activeTab === "canvas" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                CANVAS
                {activeTab === "canvas" && (
                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
                )}
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleTabChange("bookmarks")}
                className={`py-2 px-1 relative transition-colors hover:text-accent cursor-pointer ${
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
                onClick={() => handleTabChange("admin")}
                className={`py-2 px-1 relative transition-colors hover:text-accent flex items-center gap-1 cursor-pointer ${
                  activeTab === "admin" ? "text-accent font-semibold" : "opacity-80"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                ผู้ดูแลระบบ
                {activeTab === "admin" && (
                  <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-accent transition-colors" />
                )}
              </button>
            </li>
          </ul>
        </div>
 
        {/* Right Side: Theme Dots & Auth action & Mobile Hamburger Trigger */}
        <div className="flex items-center gap-4">
          {/* Desktop Theme Dots */}
          <div className="hidden md:flex gap-2">
            {(["light", "sepia", "charcoal", "oled"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => applyTheme(t)}
                className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                  activeTheme === t ? "scale-125 border-accent" : "border-border hover:scale-110"
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
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] prompt-light opacity-60 hidden lg:inline max-w-[100px] truncate" title={session.user.email}>
                  {session.user.email}
                </span>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs prompt-medium text-foreground hover:text-accent border border-border bg-surface px-3.5 py-1.5 rounded-full cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setAuthMode("login");
                  setIsAuthModalOpen(true);
                  setAuthError(null);
                }}
                className="flex items-center gap-1.5 text-xs prompt-semibold text-background bg-foreground hover:opacity-90 px-4 py-1.5 rounded-full cursor-pointer transition-all shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                เข้าสู่ระบบ
              </button>
            )}
          </div>
 
          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
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
                className="p-2 rounded-lg hover:bg-surface transition-all"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vertical Drawer Menu Links */}
            <ul className="flex flex-col gap-6 text-lg font-medium prompt-regular">
              <li>
                <button 
                  onClick={() => handleTabChange("originals")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                    activeTab === "originals" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  ออริจินัล
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabChange("genres")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                    activeTab === "genres" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  หมวดหมู่
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabChange("ranking")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                    activeTab === "ranking" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  อันดับ
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabChange("canvas")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                    activeTab === "canvas" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  CANVAS
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabChange("bookmarks")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent transition-colors ${
                    activeTab === "bookmarks" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  บุ๊กมาร์ก
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTabChange("admin")}
                  className={`w-full text-left py-2 border-b border-transparent hover:text-accent flex items-center gap-2 transition-colors ${
                    activeTab === "admin" ? "text-accent font-semibold" : "opacity-80"
                  }`}
                >
                  <Shield className="w-4 h-4 text-accent/80" />
                  ผู้ดูแลระบบ
                </button>
              </li>
              <li className="mt-2 border-t border-border/50 pt-4">
                {session ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] prompt-light opacity-60 truncate">
                      ล็อกอิน: {session.user.email}
                    </span>
                    <button 
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left py-2 text-accent font-semibold flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      ออกจากระบบ
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setAuthMode("login");
                      setIsAuthModalOpen(true);
                      setAuthError(null);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left py-2 font-semibold flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <User className="w-4 h-4" />
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
                  onClick={() => applyTheme(t)}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Quick Resume Banner */}
        {resumeManga && resumeChapter && (
          <div 
            onClick={() => handleSelectManga(resumeManga)}
            className="flex items-center gap-4 bg-surface border border-border p-3 px-4 rounded-xl mb-6 transition-all hover:border-accent cursor-pointer group"
          >
            {/* Manga Cover Image */}
            <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0 shadow-sm border border-border/10">
              <img 
                src={resumeManga.cover} 
                alt={`${resumeManga.title} Cover`}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            
            {/* Metadata Text */}
            <div className="flex-1 min-w-0">
              <span className="prompt-light text-[10px] uppercase tracking-wider opacity-60 block">Continue Reading / อ่านต่อที่ค้างไว้</span>
              <h3 className="prompt-semibold text-base leading-snug truncate mt-0.5">{resumeManga.title}</h3>
              <p className="prompt-light text-xs opacity-75 truncate mt-0.5">{resumeChapter.title}</p>
            </div>
            
            {/* Resume Button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleSelectManga(resumeManga);
              }}
              className="bg-foreground text-background prompt-medium text-xs px-5 py-2 rounded-full hover:opacity-90 transition-opacity flex-shrink-0"
            >
              อ่านต่อ
            </button>
          </div>
        )}

        {/* Local ZIP / CBZ File Reader Widget */}
        {activeTab !== "admin" && (
          <div className="bg-surface/40 border border-dashed border-border rounded-2xl p-6 mb-8 text-center transition-all hover:border-accent/60 relative group">
            <input 
              type="file" 
              id="local-file-input" 
              accept=".zip,.cbz"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLocalZipFile(file);
              }}
              className="hidden"
            />
            <label 
              htmlFor="local-file-input"
              className="flex flex-col items-center justify-center cursor-pointer gap-3"
            >
              <div className="p-3 bg-surface border border-border rounded-full group-hover:scale-110 transition-transform">
                <FileArchive className="w-6 h-6 text-accent" />
              </div>
              <div className="space-y-1">
                <p className="prompt-medium text-sm">
                  {localReaderLoading ? "กำลังคลายบีบอัดไฟล์การ์ตูน..." : "อ่านจากไฟล์ ZIP / CBZ ในเครื่อง"}
                </p>
                <p className="prompt-light text-xs opacity-60">
                  ลากและวางไฟล์ .zip หรือ .cbz ของคุณลงที่ใดก็ได้ในหน้าจอ หรือคลิกเพื่ออัปโหลดเพื่อเปิดอ่านแบบออฟไลน์
                </p>
              </div>
            </label>
            {localReaderLoading && (
              <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm rounded-2xl flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="text-xs prompt-medium">กำลังโหลดไฟล์การ์ตูน...</span>
              </div>
            )}
          </div>
        )}

        {/* Tab Sub-controls for secondary filtering (Genres / Ranking views) */}
        {activeTab === "genres" && (
          <div className="flex flex-wrap gap-2 mb-8 bg-surface/50 border border-border/40 p-4 rounded-xl transition-all">
            <span className="w-full text-xs uppercase tracking-wider opacity-60 mb-1 flex items-center gap-1.5 prompt-light">
              <Filter className="w-3.5 h-3.5" />
              Filter by Genre:
            </span>
            <button
              onClick={() => setSelectedGenre(null)}
              className={`text-xs prompt-medium px-4 py-1.5 rounded-full transition-all border ${
                selectedGenre === null 
                  ? "bg-foreground text-background border-transparent" 
                  : "bg-surface border-border hover:border-accent"
              }`}
            >
              ทั้งหมด
            </button>
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`text-xs prompt-medium px-4 py-1.5 rounded-full transition-all border ${
                  selectedGenre === genre 
                    ? "bg-foreground text-background border-transparent" 
                    : "bg-surface border-border hover:border-accent"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        )}

        {activeTab === "ranking" && (
          <div className="flex flex-wrap gap-2 mb-8 bg-surface/50 border border-border/40 p-4 rounded-xl transition-all">
            <span className="w-full text-xs uppercase tracking-wider opacity-60 mb-1 flex items-center gap-1.5 prompt-light">
              <TrendingUp className="w-3.5 h-3.5" />
              Sort order:
            </span>
            <button
              onClick={() => setSortBy("default")}
              className={`text-xs prompt-medium px-4 py-1.5 rounded-full transition-all border ${
                sortBy === "default" 
                  ? "bg-foreground text-background border-transparent" 
                  : "bg-surface border-border hover:border-accent"
              }`}
            >
              ค่าเริ่มต้น
            </button>
            <button
              onClick={() => setSortBy("popular")}
              className={`text-xs prompt-medium px-4 py-1.5 rounded-full transition-all border ${
                sortBy === "popular" 
                  ? "bg-foreground text-background border-transparent" 
                  : "bg-surface border-border hover:border-accent"
              }`}
            >
              ยอดนิยมสูงสุด
            </button>
            <button
              onClick={() => setSortBy("alphabetical")}
              className={`text-xs prompt-medium px-4 py-1.5 rounded-full transition-all border ${
                sortBy === "alphabetical" 
                  ? "bg-foreground text-background border-transparent" 
                  : "bg-surface border-border hover:border-accent"
              }`}
            >
              ตามตัวอักษร ก-ฮ
            </button>
          </div>
        )}

        {activeTab === "admin" ? (
          <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 max-w-2xl mx-auto w-full mb-16 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6 border-b border-border/60 pb-4">
              <Shield className="w-6 h-6 text-accent" />
              <div>
                <h2 className="prompt-bold text-xl">ระบบจัดการข้อมูลมังงะ (Admin Portal)</h2>
                <p className="prompt-light text-xs opacity-60">ป้อนข้อมูลเพื่อเรียกข้อมูลตอนใหม่จากไฟล์ ZIP เข้าสู่ระบบ</p>
              </div>
            </div>

            <form onSubmit={handleAdminIngest} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80 flex items-center gap-1.5">
                  Manga ID <span className="text-accent">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="เช่น webtoon-character-kang-lim, tokyo-cafe"
                  value={adminMangaId}
                  onChange={(e) => setAdminMangaId(e.target.value)}
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs prompt-semibold opacity-80">
                    Chapter ID <span className="text-accent">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="เช่น kanglim-ch25"
                    value={adminChapterId}
                    onChange={(e) => setAdminChapterId(e.target.value)}
                    className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs prompt-semibold opacity-80">
                    Chapter Title <span className="text-accent">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="เช่น ตอนที่ 25"
                    value={adminChapterTitle}
                    onChange={(e) => setAdminChapterTitle(e.target.value)}
                    className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80 flex items-center gap-1.5">
                  ZIP Download URL <span className="text-accent">*</span>
                </label>
                <input 
                  type="url"
                  required
                  placeholder="https://example.com/manga-ch25.zip"
                  value={adminZipUrl}
                  onChange={(e) => setAdminZipUrl(e.target.value)}
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                />
                <p className="text-[10px] prompt-light opacity-50">
                  ต้องเป็น URL สาธารณะที่สามารถดาวน์โหลดไฟล์ ZIP/CBZ ได้โดยตรง
                </p>
              </div>

              {adminSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-xl text-xs prompt-regular">
                  {adminSuccess}
                </div>
              )}

              {adminError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-xs prompt-regular">
                  {adminError}
                </div>
              )}

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"
              >
                {adminLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังส่งคิวให้ GitHub Actions...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    เริ่มกระบวนการจัดเก็บรูปภาพ (Ingest)
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Dynamic Section Header Title */}
            <h2 className="prompt-semibold text-xl mb-6 flex items-center gap-2">
              {activeTab === "originals" && <Sparkles className="w-5 h-5 opacity-70" />}
              {activeTab === "genres" && <Filter className="w-5 h-5 opacity-70" />}
              {activeTab === "ranking" && <TrendingUp className="w-5 h-5 opacity-70" />}
              {activeTab === "canvas" && <Layers className="w-5 h-5 opacity-70" />}
              {activeTab === "bookmarks" && <Bookmark className="w-5 h-5 opacity-70" />}
              {activeTab === "originals" && "ผลงานออริจินัลสุดพิเศษ"}
              {activeTab === "genres" && `หมวดหมู่${selectedGenre ? `: ${selectedGenre}` : "ทั้งหมด"}`}
              {activeTab === "ranking" && "การจัดอันดับมังงะสุดฮิต"}
              {activeTab === "canvas" && "ผลงานอิสระของเหล่าครีเอเตอร์ (CANVAS)"}
              {activeTab === "bookmarks" && "บุ๊กมาร์กของฉัน"}
            </h2>

            {/* Library Grid */}
            {filteredMangas.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10 mb-16">
                {filteredMangas.map((manga) => (
                  <article 
                    key={manga.id} 
                    onClick={() => handleSelectManga(manga)}
                    className="flex flex-col cursor-pointer group"
                  >
                    <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface shadow-sm transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-lg border border-border/20">
                      <img 
                        src={manga.cover} 
                        alt={`${manga.title} Cover`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Bookmark Button */}
                      <button
                        onClick={(e) => toggleBookmark(e, manga.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border text-foreground hover:text-accent hover:scale-110 transition-all z-20 shadow-sm cursor-pointer"
                        title={bookmarks.includes(manga.id) ? "ยกเลิกบุ๊กมาร์ก" : "บันทึกบุ๊กมาร์ก"}
                      >
                        <Bookmark 
                          size={14} 
                          className={bookmarks.includes(manga.id) ? "fill-accent text-accent" : "opacity-70"} 
                        />
                      </button>
                      {/* Badge showing ranking if in Ranking Tab */}
                      {activeTab === "ranking" && sortBy === "popular" && (
                        <div className="absolute top-2 left-2 bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md">
                          {mangas.findIndex(m => m.id === manga.id) + 1}
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <h3 className="prompt-semibold text-md line-clamp-1 group-hover:text-accent transition-colors">
                        {manga.title}
                      </h3>
                      <p className="prompt-light text-xs opacity-60 mt-0.5">{manga.author}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-border/60 rounded-xl mb-16">
                <span className="text-4xl mb-3">🔍</span>
                <p className="prompt-medium text-lg opacity-70">ไม่พบผลงานที่ต้องการในขณะนี้</p>
                <button 
                  onClick={() => handleTabChange("originals")}
                  className="mt-3 text-xs prompt-medium text-accent hover:underline"
                >
                  กลับหน้าหลัก
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Fullscreen Immersive Reader Overlay */}
      {activeManga && (
        <div className="fixed inset-0 w-full h-full bg-background z-[1000] flex flex-col select-none overflow-hidden transition-colors">
          
          {/* Top Control Bar */}
          <header className={`fixed top-0 left-0 w-full bg-background/95 backdrop-blur-md z-[1010] p-4 px-6 flex justify-between items-center border-b border-border transition-all duration-300 ${
            (showControls || isChapterPanelOpen) ? "translate-y-0" : "-translate-y-full"
          }`}>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleCloseReader}
                className="flex items-center gap-1 prompt-medium text-sm hover:translate-x-[-3px] transition-transform"
              >
                <ChevronLeft className="w-5 h-5" />
                Library
              </button>
              <h2 className="prompt-semibold text-md truncate max-w-[200px] sm:max-w-md">
                {activeManga.title} <span className="prompt-light text-xs opacity-60 ml-2">({currentChapter?.title})</span>
              </h2>
            </div>
            
            {/* Top horizontal progress bar indicator */}
            <div 
              className="absolute bottom-0 left-0 h-[3px] bg-accent transition-all duration-150" 
              style={{ width: `${scrollPercent}%` }}
            />
          </header>

          {/* Core Reader Viewer Area */}
          <div 
            ref={readerContentRef}
            onScroll={handleReaderScroll}
            onClick={() => {
              if (readingMode === "vertical") {
                setShowControls(!showControls);
                if (!showControls) resetControlsTimeout();
              }
            }}
            className="flex-1 w-full overflow-x-hidden relative flex flex-col items-center justify-start focus:outline-none"
            style={{ 
              overflowY: readingMode === "vertical" ? "auto" : "hidden" 
            }}
          >
            {/* Click handlers overlay */}
            {readingMode === "horizontal" && (
              <div className="absolute inset-0 w-full h-full flex z-[999] pointer-events-none">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateHorizontalPage(-1);
                  }}
                  className="w-[20%] h-full cursor-w-resize pointer-events-auto"
                />
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowControls(!showControls);
                    if (!showControls) resetControlsTimeout();
                  }}
                  className="w-[60%] h-full cursor-pointer pointer-events-auto"
                />
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateHorizontalPage(1);
                  }}
                  className="w-[20%] h-full cursor-e-resize pointer-events-auto"
                />
              </div>
            )}

            {/* Vertical Scroll Layout */}
            {readingMode === "vertical" ? (
              <div className="w-full max-w-[700px] mx-auto flex flex-col relative z-10">
                {currentChapter?.pages.map((url, idx) => (
                  <img 
                    key={idx}
                    src={url} 
                    alt={`Page ${idx + 1}`}
                    className="w-full h-auto block manga-page-img"
                    loading={idx > 2 ? "lazy" : "eager"}
                  />
                ))}
                
                {/* Next Chapter Loading Indicator */}
                <div className="w-full text-center py-16 border-t border-dashed border-border mt-8 flex flex-col items-center">
                  <span className="prompt-medium text-lg opacity-60">
                    {activeManga.chapters.findIndex(ch => ch.id === activeChapterId) < activeManga.chapters.length - 1 
                      ? "Scroll to load next chapter"
                      : "End of Manga"}
                  </span>
                </div>
              </div>
            ) : (
              /* Horizontal Page Switch Layout */
              <div className="w-full h-full flex justify-center items-center p-4">
                <div className="max-w-[90%] max-h-[95%] flex items-center justify-center transition-transform">
                  {currentChapter && (
                    <img 
                      src={currentChapter.pages[currentPageIndex]} 
                      alt={`Page ${currentPageIndex + 1}`}
                      className="max-h-[92vh] max-w-full object-contain shadow-md manga-page-img"
                    />
                  )}
                </div>
                {/* Page Indicator */}
                {currentChapter && (
                  <div className="fixed bottom-6 right-6 bg-surface/80 border border-border backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs prompt-semibold z-[1005]">
                    {currentPageIndex + 1} / {currentChapter.pages.length}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <footer className={`fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-md z-[1010] p-4 px-6 flex justify-between items-center border-t border-border transition-all duration-300 ${
            (showControls || isChapterPanelOpen) ? "translate-y-0" : "translate-y-full"
          }`}>
            <div className="flex items-center gap-2">
              <span className="prompt-light text-xs uppercase tracking-wider opacity-60 hidden sm:inline">Layout:</span>
              <button 
                onClick={() => {
                  setReadingMode(readingMode === "vertical" ? "horizontal" : "vertical");
                  resetControlsTimeout();
                }}
                className="bg-surface border border-border text-foreground text-xs prompt-medium px-4 py-1.5 rounded-full hover:border-accent transition-colors"
              >
                {readingMode === "vertical" ? "Webtoon (Vertical)" : "Manga (Horizontal)"}
              </button>
            </div>

            {/* Chapter Selector Dropdown */}
            <div className="relative">
              {/* Overlay Backdrop to close menu */}
              {isChapterPanelOpen && (
                <div 
                  className="fixed inset-0 z-[1015] bg-transparent"
                  onClick={() => {
                    setIsChapterPanelOpen(false);
                    resetControlsTimeout();
                  }}
                />
              )}

              <div className="flex items-center gap-1 bg-surface border border-border rounded-full p-1 shadow-sm relative z-[1020]">
                {/* Prev Button */}
                <button
                  disabled={currentChapterIdx <= 0}
                  onClick={() => {
                    if (currentChapterIdx > 0 && activeManga) {
                      const prevChId = activeManga.chapters[currentChapterIdx - 1].id;
                      launchReader(activeManga, prevChId, 0, 0);
                    }
                    resetControlsTimeout();
                  }}
                  className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="ตอนก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Chapter Pill Button */}
                <button 
                  onClick={() => {
                    setIsChapterPanelOpen(!isChapterPanelOpen);
                    resetControlsTimeout();
                  }}
                  className="px-3 py-1 rounded-full text-foreground text-xs prompt-medium hover:bg-foreground/5 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="max-w-[120px] sm:max-w-[160px] truncate">
                    {currentChapter?.title || "เลือกตอน"}
                  </span>
                  {isChapterPanelOpen ? (
                    <ChevronUp size={14} className="text-accent opacity-80" />
                  ) : (
                    <ChevronDown size={14} className="opacity-60" />
                  )}
                </button>

                {/* Next Button */}
                <button
                  disabled={currentChapterIdx >= (activeManga?.chapters.length || 0) - 1}
                  onClick={() => {
                    if (activeManga && currentChapterIdx < activeManga.chapters.length - 1) {
                      const nextChId = activeManga.chapters[currentChapterIdx + 1].id;
                      launchReader(activeManga, nextChId, 0, 0);
                    }
                    resetControlsTimeout();
                  }}
                  className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="ตอนถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Popover list of Chapters */}
              {isChapterPanelOpen && activeManga && (
                <div className="absolute bottom-[48px] right-0 sm:right-1/2 sm:translate-x-1/2 z-[1025] w-64 max-h-72 overflow-y-auto bg-surface border border-border rounded-2xl shadow-xl p-1.5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 scrollbar-thin">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-foreground/50 prompt-semibold border-b border-border/50 mb-1 select-none">
                    เลือกตอน ({activeManga.chapters.length} ตอน)
                  </div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto pr-0.5">
                    {activeManga.chapters.map((ch, idx) => {
                      const isActive = ch.id === activeChapterId;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => {
                            launchReader(activeManga, ch.id, 0, 0);
                            setIsChapterPanelOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs prompt-medium transition-all duration-150 flex items-center justify-between cursor-pointer ${
                            isActive 
                              ? "bg-accent/10 text-accent font-semibold" 
                              : "text-foreground hover:bg-foreground/5"
                          }`}
                        >
                          <span className="truncate">{ch.title}</span>
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </footer>

        </div>
      )}

      {/* Drag and Drop Fullscreen Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[2000] flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <div className="border-2 border-dashed border-accent/60 rounded-3xl p-16 flex flex-col items-center justify-center gap-4 max-w-lg mx-auto m-6">
            <FileArchive className="w-16 h-16 text-accent animate-bounce" />
            <p className="prompt-semibold text-lg text-foreground text-center">
              วางไฟล์ ZIP หรือ CBZ ของคุณที่นี่เพื่อเปิดอ่านแบบออฟไลน์
            </p>
            <p className="prompt-light text-xs opacity-60 text-center">
              ระบบจะคลายรูปภาพและรันโปรแกรมอ่านในเบราว์เซอร์ของคุณทันทีโดยไม่บันทึกลงเซิร์ฟเวอร์
            </p>
          </div>
        </div>
      )}

      {/* Supabase Authentication Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer text-foreground"
              aria-label="Close auth modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="prompt-bold text-xl">
                {authMode === "login" ? "เข้าสู่ระบบสมาชิก" : "สมัครสมาชิกใหม่"}
              </h3>
              <p className="prompt-light text-xs opacity-60 mt-1">
                {authMode === "login" 
                  ? "เข้าสู่ระบบเพื่อสำรองข้อมูลบุ๊กมาร์กและอ่านต่อได้จากทุกอุปกรณ์" 
                  : "สร้างบัญชีใหม่เพื่อเชื่อมข้อมูลบุ๊กมาร์กและประวัติการอ่านของคุณ"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs prompt-semibold opacity-80">อีเมล (Email)</label>
                <input 
                  type="email"
                  required
                  placeholder="yourname@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
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
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full text-sm prompt-regular px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-xs prompt-regular">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm prompt-semibold"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังดำเนินการ...
                  </>
                ) : (
                  <>
                    {authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                  </>
                )}
              </button>
            </form>

            {/* Mode Toggle Switcher */}
            <div className="text-center mt-6 pt-4 border-t border-border/60">
              <p className="prompt-light text-xs opacity-75">
                {authMode === "login" ? "ยังไม่มีบัญชีสมาชิก?" : "มีบัญชีสมาชิกอยู่แล้ว?"}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setAuthError(null);
                  }}
                  className="text-accent font-semibold ml-1.5 hover:underline cursor-pointer bg-transparent border-none"
                >
                  {authMode === "login" ? "สมัครสมาชิกที่นี่" : "เข้าสู่ระบบที่นี่"}
                </button>
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
