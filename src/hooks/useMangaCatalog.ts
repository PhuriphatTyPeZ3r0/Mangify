"use client";

import { useState, useEffect } from "react";
import { Manga } from "../types";
import { demoManga as initialManga } from "../data/mangaData";

export function useMangaCatalog(bookmarks: string[]) {
  const [mangas, setMangas] = useState<Manga[]>(initialManga);
  const [activeTab, setActiveTab] = useState<string>("originals");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "popular" | "alphabetical">(
    "default"
  );

  // Fetch catalog from database on mount
  useEffect(() => {
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
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Reset secondary filters when switching main tabs
    if (tab !== "genres") setSelectedGenre(null);
    if (tab !== "ranking") setSortBy("default");
  };

  const allGenres = Array.from(
    new Set(mangas.flatMap((m) => m.genres || []))
  );

  const filteredMangas = mangas
    .filter((manga) => {
      if (activeTab === "originals") return manga.isOriginal === true;
      if (activeTab === "canvas") return manga.isOriginal === false;
      if (activeTab === "bookmarks") return bookmarks.includes(manga.id);
      return true;
    })
    .filter((manga) => {
      if (activeTab === "genres" && selectedGenre) {
        return manga.genres?.includes(selectedGenre);
      }
      return true;
    })
    .sort((a, b) => {
      if (activeTab === "ranking") {
        if (sortBy === "popular")
          return (b.popularity || 0) - (a.popularity || 0);
        if (sortBy === "alphabetical")
          return a.title.localeCompare(b.title);
      }
      return 0;
    });

  return {
    mangas,
    filteredMangas,
    activeTab,
    handleTabChange,
    selectedGenre,
    setSelectedGenre,
    sortBy,
    setSortBy,
    allGenres,
  };
}
