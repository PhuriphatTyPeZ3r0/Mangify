"use client";

import { useState, useEffect, useRef } from "react";
import { ReadingProgress } from "../types";

export function useReadingProgress(userId: string, session: any) {
  const [history, setHistory] = useState<ReadingProgress | null>(null);
  const lastSyncedProgressRef = useRef<{
    chapterId: string;
    pageIndex: number;
    scrollPercent: number;
  } | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load last progress from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("mangify-history");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Fetch latest progress from server when userId or session changes
  useEffect(() => {
    if (!userId) return;
    const token = session?.access_token;

    const fetchProgress = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/sync/progress?userId=${userId}`, {
          headers,
        });
        const data = await res.json();
        if (data.progress && data.progress.length > 0) {
          const sortedProgress = data.progress.sort(
            (a: any, b: any) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime()
          );
          const latest = sortedProgress[0];
          const mappedHistory: ReadingProgress = {
            mangaId: latest.manga_id,
            chapterId: latest.chapter_id,
            pageIndex: latest.page_index,
            scrollPercent: latest.scroll_percent,
          };
          setHistory(mappedHistory);
          localStorage.setItem(
            "mangify-history",
            JSON.stringify(mappedHistory)
          );
        }
      } catch (err) {
        console.error("Failed to fetch reading progress:", err);
      }
    };

    fetchProgress();
  }, [userId, session?.access_token]);

  /**
   * Debounced sync — queues a server write that fires after 10s of inactivity.
   */
  const queueSyncProgress = (
    mangaId: string,
    chapterId: string,
    pageIndex: number,
    percent: number
  ) => {
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

        lastSyncedProgressRef.current = {
          chapterId,
          pageIndex,
          scrollPercent: percent,
        };
      } catch (err) {
        console.error("Failed to sync progress to cloud:", err);
      }
    }, 10000);
  };

  const saveProgress = (
    mangaId: string,
    chapterId: string,
    pageIndex: number,
    percent: number
  ) => {
    const progress: ReadingProgress = {
      mangaId,
      chapterId,
      pageIndex,
      scrollPercent: percent,
    };
    localStorage.setItem("mangify-history", JSON.stringify(progress));
    setHistory(progress);
    queueSyncProgress(mangaId, chapterId, pageIndex, percent);
  };

  const syncProgressImmediately = async (
    mangaId: string,
    chapterId: string,
    pageIndex: number,
    percent: number
  ) => {
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
      lastSyncedProgressRef.current = {
        chapterId,
        pageIndex,
        scrollPercent: percent,
      };
    } catch (err) {
      console.error("Failed to sync progress immediately:", err);
    }
  };

  const clearSyncTimeout = () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  };

  return { history, saveProgress, syncProgressImmediately, clearSyncTimeout };
}
