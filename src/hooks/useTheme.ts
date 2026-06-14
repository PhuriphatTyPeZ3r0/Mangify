"use client";

import { useState, useEffect } from "react";
import { Theme } from "../types";

export function useTheme() {
  const [activeTheme, setActiveTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("mangify-theme") as Theme;
    applyThemeInternal(savedTheme || "light");
  }, []);

  const applyThemeInternal = (theme: Theme) => {
    setActiveTheme(theme);
    localStorage.setItem("mangify-theme", theme);
    document.body.className = `theme-${theme}`;
  };

  return { activeTheme, applyTheme: applyThemeInternal };
}
