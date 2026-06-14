"use client";

import { useState, useEffect, useRef } from "react";
import { Manga, ReadingMode } from "../types";

interface UseReaderDeps {
  saveProgress: (
    mangaId: string,
    chapterId: string,
    pageIndex: number,
    percent: number
  ) => void;
  syncProgressImmediately: (
    mangaId: string,
    chapterId: string,
    pageIndex: number,
    percent: number
  ) => void;
  clearSyncTimeout: () => void;
}

export function useReader({
  saveProgress,
  syncProgressImmediately,
  clearSyncTimeout,
}: UseReaderDeps) {
  const [activeManga, setActiveManga] = useState<Manga | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>("");
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [scrollPercent, setScrollPercent] = useState<number>(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>("vertical");
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isChapterPanelOpen, setIsChapterPanelOpen] = useState<boolean>(false);

  const readerContentRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Computed values
  const currentChapter = activeManga?.chapters.find(
    (ch) => ch.id === activeChapterId
  );
  const currentChapterIdx =
    activeManga && activeChapterId
      ? activeManga.chapters.findIndex((ch) => ch.id === activeChapterId)
      : -1;

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current)
      clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(
      () => setShowControls(false),
      3000
    );
  };

  const launchReader = (
    manga: Manga,
    chapterId: string,
    pageIndex = 0,
    scrollPct = 0
  ) => {
    setActiveManga(manga);
    setActiveChapterId(chapterId);
    setCurrentPageIndex(pageIndex);
    setScrollPercent(scrollPct);
    setShowControls(true);
    document.body.style.overflow = "hidden";
    resetControlsTimeout();

    // Scroll to saved position after render (vertical mode)
    setTimeout(() => {
      if (readerContentRef.current) {
        const container = readerContentRef.current;
        const scrollHeight =
          container.scrollHeight - container.clientHeight;
        container.scrollTop = scrollHeight * (scrollPct / 100);
      }
    }, 150);
  };

  const handleCloseReader = () => {
    if (activeManga && activeChapterId) {
      saveProgress(
        activeManga.id,
        activeChapterId,
        currentPageIndex,
        scrollPercent
      );
      syncProgressImmediately(
        activeManga.id,
        activeChapterId,
        currentPageIndex,
        scrollPercent
      );
    }
    setActiveManga(null);
    document.body.style.overflow = "";
    if (controlsTimeoutRef.current)
      clearTimeout(controlsTimeoutRef.current);
    clearSyncTimeout();
  };

  const navigateHorizontalPage = (direction: number) => {
    if (!activeManga || !activeChapterId) return;
    const chapter = activeManga.chapters.find(
      (ch) => ch.id === activeChapterId
    );
    if (!chapter) return;

    const newIndex = currentPageIndex + direction;
    if (newIndex >= 0 && newIndex < chapter.pages.length) {
      setCurrentPageIndex(newIndex);
      const percent = ((newIndex + 1) / chapter.pages.length) * 100;
      setScrollPercent(percent);
      saveProgress(activeManga.id, activeChapterId, newIndex, percent);
      resetControlsTimeout();
    } else if (newIndex >= chapter.pages.length) {
      // Advance to next chapter
      const currentIdx = activeManga.chapters.findIndex(
        (ch) => ch.id === activeChapterId
      );
      if (currentIdx < activeManga.chapters.length - 1) {
        const nextChId = activeManga.chapters[currentIdx + 1].id;
        launchReader(activeManga, nextChId, 0, 0);
      } else {
        handleCloseReader();
      }
    } else if (newIndex < 0) {
      // Go back to previous chapter's last page
      const currentIdx = activeManga.chapters.findIndex(
        (ch) => ch.id === activeChapterId
      );
      if (currentIdx > 0) {
        const prevCh = activeManga.chapters[currentIdx - 1];
        launchReader(
          activeManga,
          prevCh.id,
          prevCh.pages.length - 1,
          100
        );
      }
    }
  };

  const handleReaderScroll = () => {
    if (
      readingMode !== "vertical" ||
      !activeManga ||
      !activeChapterId ||
      !readerContentRef.current
    )
      return;
    const container = readerContentRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const percent =
      scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

    setScrollPercent(percent);
    saveProgress(activeManga.id, activeChapterId, 0, percent);

    // Auto-advance to next chapter at bottom
    if (percent > 99.5) {
      const currentIdx = activeManga.chapters.findIndex(
        (ch) => ch.id === activeChapterId
      );
      if (currentIdx < activeManga.chapters.length - 1) {
        const nextChId = activeManga.chapters[currentIdx + 1].id;
        launchReader(activeManga, nextChId, 0, 0);
      }
    }
  };

  const toggleReadingMode = () => {
    setReadingMode((prev) =>
      prev === "vertical" ? "horizontal" : "vertical"
    );
    resetControlsTimeout();
  };

  // Keyboard navigation
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

  return {
    activeManga,
    activeChapterId,
    currentPageIndex,
    scrollPercent,
    readingMode,
    showControls,
    isChapterPanelOpen,
    currentChapter,
    currentChapterIdx,
    readerContentRef,
    launchReader,
    handleCloseReader,
    navigateHorizontalPage,
    handleReaderScroll,
    resetControlsTimeout,
    toggleReadingMode,
    setShowControls,
    setIsChapterPanelOpen,
  };
}
