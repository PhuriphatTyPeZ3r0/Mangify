# 🎨 Design System — Mangify

> **Source of Truth:** `DESIGN.md` + `src/app/globals.css`
> **Font:** Prompt (Google Fonts) — รองรับทั้ง Thai + Latin
> **Icons:** Google Material Symbols (Outlined)

---

## 🌈 Theme Palette

| Theme | Background | Foreground | Surface | Accent | Border |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Light** | `#faf8f5` Milk White | `#2b2621` Warm Charcoal | `#f3efe9` Pale Cream | `#d35400` Burnt Orange | `#e6dfd5` Sand Beige |
| **Sepia** | `#f4ebd8` Aged Paper | `#3a2f23` Dark Brown | `#e7dcbf` Deep Sepia | `#a0522d` Sienna Clay | `#decfa7` Warm Tan |
| **Charcoal** | `#1a1c23` Cool Slate | `#b2b8c5` Gray-Blue | `#232731` Charcoal | `#88a2ce` Lavender Blue | `#2e3340` Slate Gray |
| **OLED** | `#000000` Absolute Black | `#9ca3af` Medium Gray | `#121212` Very Dark | `#e5e7eb` Platinum | `#1e1e1e` Near-Black |

### การสลับธีม
- Root element: `html.theme-<name>` + `data-theme` attribute
- ปุ่ม cycle: Sun → Book → Moon → Power
- ค่าบันทึกใน `localStorage` + sync ขึ้น `profiles.preferred_theme` (ถ้า logged in)

---

## 🧩 Core Components

### 1. Navbar (`Navbar.tsx`)
- Sticky header, full-width
- แท็บ: Originals / All / Bookmarks / History
- Theme Switcher + Auth actions

### 2. Library Grid (`LibraryGrid.tsx`)
- Responsive flex/grid cover cards
- Genre pill filters + Search bar + Sort dropdown
- Hover: scale-up animation + metadata fade-in

### 3. Manga Info Modal (`MangaInfoModal.tsx`)
- Layout 2 คอลัมน์ (Desktop): ปกซ้าย + ข้อมูลขวา
- Chapter list + reading progress highlights
- Age Gate lock สำหรับ `is_mature = true`

### 4. Reader Overlay (`ReaderOverlay.tsx`)
- Full-screen immersive vertical scroll
- Auto-hide controls (4s inactivity)
- Brightness dimming ใน Charcoal/OLED mode (`filter: brightness(0.88)`)
- Auto-load next chapter ที่ท้ายตอน

### 5. Quick Resume Banner (`QuickResumeBanner.tsx`)
- Fixed bottom-right, แสดงเฉพาะเมื่อมี active reading progress
- Thumbnail + chapter number + Resume link

### 6. Auth Modal (`AuthModal.tsx`)
- Glassmorphism (frosted glass) overlays
- Email/Password → 2FA verification slide

### 7. Profile Portal (`ProfilePortal.tsx`)
- แก้ไขข้อมูลผู้ใช้ (display name, birth date, favorite genres, theme)
- Sync ข้อมูลกลับ Supabase

### 8. Admin Portal (`AdminPortal.tsx`)
- ZIP ingestion forms
- Manga catalog management

---

## ⚡ Transitions & Animations

| Type | Duration | Curve | ใช้กับ |
| :--- | :--- | :--- | :--- |
| Interactive | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Card hover, button states |
| Comfort | 350ms | `ease-out` | Theme crossfade, layout |

---

## 📐 Responsive Breakpoints

| Breakpoint | Min-width |
| :--- | :--- |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

**Max container:** 1280px (`max-w-7xl`)

---

## 🔗 Related Notes

- [[00 - Mangify Project Overview]]
