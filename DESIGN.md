---
name: Mangify Design System
version: 1.0.0
themes:
  light:
    background: "#faf8f5"
    foreground: "#2b2621"
    surface: "#f3efe9"
    accent: "#d35400"
    border: "#e6dfd5"
  sepia:
    background: "#f4ebd8"
    foreground: "#3a2f23"
    surface: "#e7dcbf"
    accent: "#a0522d"
    border: "#decfa7"
  charcoal:
    background: "#1a1c23"
    foreground: "#b2b8c5"
    surface: "#232731"
    accent: "#88a2ce"
    border: "#2e3340"
  oled:
    background: "#000000"
    foreground: "#9ca3af"
    surface: "#121212"
    accent: "#e5e7eb"
    border: "#1e1e1e"
typography:
  fontFamily: "Prompt, sans-serif"
  weights:
    thin: 100
    extralight: 200
    light: 300
    regular: 400
    medium: 500
    semibold: 600
    bold: 700
    extrabold: 800
    black: 900
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
shadows:
  light-sepia:
    sm: "0 1px 2px 0 rgba(43, 38, 33, 0.05)"
    md: "0 4px 6px -1px rgba(43, 38, 33, 0.1), 0 2px 4px -1px rgba(43, 38, 33, 0.06)"
    lg: "0 10px 15px -3px rgba(43, 38, 33, 0.1), 0 4px 6px -2px rgba(43, 38, 33, 0.05)"
  charcoal-oled:
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)"
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2)"
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)"
transitions:
  default: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)"
  slow: "all 350ms ease-out"
breakpoints:
  sm: "640px"
  md: "768px"
  lg: "1024px"
  xl: "1280px"
containerWidth: "1280px"
---

# Mangify Design System & UX/UI Architecture

This document serves as the visual and behavioral source of truth for **Mangify**, a modern manga reading web application. It bridges the gap between codebase logic and design-to-code canvases (Google Stitch, Claude Code, etc.).

---

## 🎨 Visual Identity & Theme Architecture

Mangify uses a multi-theme, reader-centric aesthetic optimized for legibility and visual comfort. The interface dynamically switches classes on the root element (`html.theme-<name>`) and sets the `data-theme` attribute.

### 1. Light Mode (`.theme-light`)
*   **Background (#faf8f5):** Soft milk-white to reduce glare.
*   **Foreground (#2b2621):** Deep warm charcoal for high-contrast reading.
*   **Surface (#f3efe9):** Pale cream for cards, navigation tabs, and container backgrounds.
*   **Accent (#d35400):** Vibrant burnt orange for primary brand actions, badges, and selections.
*   **Border (#e6dfd5):** Muted sand-beige separating UI segments cleanly.
*   **Shadows:** Soft, warm-tinted brown/gray shadows.

### 2. Sepia Mode (`.theme-sepia`)
*   **Background (#f4ebd8):** Warm aged-paper yellow, mimicking classic paperback books.
*   **Foreground (#3a2f23):** Earthy dark brown.
*   **Surface (#e7dcbf):** Deeper sepia tones for container elements.
*   **Accent (#a0522d):** Sienna clay accent color.
*   **Border (#decfa7):** Warm tan dividers.
*   **Shadows:** Soft, warm sepia-tinted shadows.

### 3. Charcoal Mode (`.theme-charcoal`)
*   **Background (#1a1c23):** Cool slate dark background for night reading.
*   **Foreground (#b2b8c5):** Soft gray-blue, eliminating eye fatigue.
*   **Surface (#232731):** Charcoal card surfaces.
*   **Accent (#88a2ce):** Soft lavender blue for active states.
*   **Border (#2e3340):** Slate-gray borders.
*   **Shadows:** Deep, near-black low-opacity shadows.

### 4. OLED Black Mode (`.theme-oled`)
*   **Background (#000000):** Absolute black to save battery on OLED screens.
*   **Foreground (#9ca3af):** Medium gray, avoiding stark contrast blooms.
*   **Surface (#121212):** Very dark gray panels.
*   **Accent (#e5e7eb):** Bright platinum highlights.
*   **Border (#1e1e1e):** Near-black outlines.
*   **Shadows:** High-contrast subtle borders are preferred over heavy shadows to maintain an OLED-flat look.

---

## ✍️ Typography & Font Scale

*   **Primary Font:** `Prompt` (Google Font). A clean, modern sans-serif with high legibility across Thai and Latin scripts.
*   **Iconography:** Google Material Symbols (Outlined version; `.material-symbols-outlined` with optional `.fill` class).

---

## ⏳ Transitions & Responsive Layout

*   **Timings:**
    *   `default (200ms cubic-bezier(0.4, 0, 0.2, 1))` used for interactive micro-animations (e.g. card zoom, button states, reader layout slide-ins).
    *   `slow (350ms ease-out)` used for visual comfort transitions (e.g. background color/theme crossfades).
*   **Responsive container:** Maximum layout width set to `1280px` (`max-w-7xl` container) to ensure comfortable visual range on ultra-wide desktop monitors.

---

## 🎛️ Core UX Component Specifications

### 1. Navigation Header (`Navbar`)
*   **Structure:** Sticky-top, full-width header spanning the brand name ("Mangify"), tab bar, theme switcher, and authentication actions.
*   **Tabs:**
    *   `Originals` / `All`: Grid catalog.
    *   `Bookmarks`: Bookmarked/saved manga list.
    *   `History`: Previously read items.
*   **Theme Switcher:** Single cycle button displaying Sun (Light), Book (Sepia), Moon (Charcoal), and Power (OLED) icons sequentially.

### 2. Main Page & Library Grid (`LibraryGrid`)
*   **Layout:** Responsive flex/grid containing:
    *   **Filter Panel:** Genre pill filters (Toggleable lists: Shounen, Romance, Action, etc.) and a Search bar.
    *   **Sort Options:** Dropdown to sort by Popularity, Rating, or Latest Update.
    *   **Manga Cards:** Compact grid cards showing cover thumbnails, rating badges, titles, and quick-action bookmark buttons. Hover animations scale up cards slightly with a smooth transition.

### 3. Manga Detail Overlay (`MangaInfoModal`)
*   **Structure:** Centered modal panel displaying:
    *   **Left Column (Desktop):** Large cover illustration, bookmark toggle button.
    *   **Right Column:** Manga Title, Author, Genre Tags, Star Rating, and a large action button (either "Start Reading" or "Resume Chapter X").
    *   **Bottom Section:** Scrollable Chapter List showing chapter titles and publication dates. Visually highlights chapters already read or currently in-progress.

### 4. Reading Interface (`ReaderOverlay`)
*   **View Mode:** Full-screen immersive layout.
*   **Layout & Scrolling:**
    *   Vertical continuous-scroll stream of manga pages.
    *   **Eye Comfort Blending:** In Charcoal and OLED modes, high-contrast manga images are programmatically dimmed using `filter: brightness(0.88)` to prevent eye strain.
*   **Floating Controls:**
    *   Top Bar: Title, Chapter selector dropdown, Close (X) button.
    *   Bottom Bar: Reading progress tracker, scroll position percentage slider.
    *   *Auto-Hide Behavior:* UI controls fade out after 4 seconds of inactivity and reappear instantly on user touch/move.
*   **Infinite Reading Flow:** Reaching the end of the current page list triggers an auto-load sequence for the next chapter.

### 5. Quick Resume Banner (`QuickResumeBanner`)
*   **Placement:** Sticky banner that renders dynamically at the bottom-right of the home catalog *only* if active reading progress exists.
*   **Content:** Small thumbnail of the last read manga, current chapter number, and a direct "Resume" link.

### 6. Authentication Panel (`AuthModal` / 2FA Login)
*   **Visual style:** Minimalist frosted glass overlays (glassmorphism) for forms.
*   **UX Flow:** Prompts email/password. If the user profile requires 2FA, the modal slides smoothly to a verification code input panel before granting access.

### 7. Administrative Portal (`AdminPortal`)
*   **Content:** Ingestion forms for admins to register ZIP files, manga catalogs, and monitor background sync logs.
