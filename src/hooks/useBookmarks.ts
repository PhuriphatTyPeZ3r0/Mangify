"use client";

import { useState, useEffect } from "react";

export function useBookmarks(userId: string, session: any) {
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Fetch bookmarks whenever userId or session token changes
  useEffect(() => {
    if (!userId) return;
    const token = session?.access_token;

    const fetchBookmarks = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/sync/bookmarks?userId=${userId}`, {
          headers,
        });
        const data = await res.json();
        if (data.bookmarks) {
          setBookmarks(data.bookmarks.map((b: any) => b.manga_id));
        }
      } catch (err) {
        console.error("Failed to fetch bookmarks:", err);
      }
    };

    fetchBookmarks();
  }, [userId, session?.access_token]);

  const toggleBookmark = async (e: React.MouseEvent, mangaId: string) => {
    e.stopPropagation();
    if (!userId) return;

    const isBookmarked = bookmarks.includes(mangaId);
    const prevBookmarks = bookmarks;
    const newBookmarks = isBookmarked
      ? bookmarks.filter((id) => id !== mangaId)
      : [...bookmarks, mangaId];

    // Optimistic update
    setBookmarks(newBookmarks);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      if (isBookmarked) {
        await fetch(
          `/api/sync/bookmarks?userId=${userId}&mangaId=${mangaId}`,
          { method: "DELETE", headers }
        );
      } else {
        await fetch("/api/sync/bookmarks", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId, mangaId }),
        });
      }
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
      setBookmarks(prevBookmarks); // revert on error
    }
  };

  /**
   * Syncs local anonymous bookmarks to the authenticated user's account after login.
   */
  const syncBookmarksToUser = async (userSession: any) => {
    const userToken = userSession.access_token;
    const authUserId = userSession.user.id;

    for (const mangaId of bookmarks) {
      try {
        await fetch("/api/sync/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ userId: authUserId, mangaId }),
        });
      } catch (e) {
        console.error("Failed to sync bookmark to cloud:", mangaId, e);
      }
    }

    // Refetch the complete list under the authenticated profile
    try {
      const res = await fetch(
        `/api/sync/bookmarks?userId=${authUserId}`,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      const data = await res.json();
      if (data.bookmarks) {
        setBookmarks(data.bookmarks.map((b: any) => b.manga_id));
      }
    } catch (err) {
      console.error("Failed to refetch bookmarks after login:", err);
    }
  };

  return { bookmarks, toggleBookmark, syncBookmarksToUser };
}
