# Theme Optimization & Eye-Comfort Tuning

To elevate the reading experience and prevent eye strain across different lighting environments, the Mangify visual themes have been tuned using custom-tailored palettes.

---

## 🎨 Color Palette Design Matrix

| Theme | Target Environment | Background | Foreground (Text) | Surface (Panels) | Accent Color | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Light (Warm Minimal)** | Daytime / Ambient Light | `#faf8f5` | `#2b2621` | `#f3efe9` | `#d35400` | Soft cream background replaces harsh white; rich espresso text maintains legibility without high-contrast glare. |
| **Sepia (Classic Paper)** | Long Reading Sessions | `#f4ebd8` | `#3a2f23` | `#e7dcbf` | `#a0522d` | Mimics physical book paper and Kindle e-readers; brown sienna text minimizes blue light emission. |
| **Charcoal (Soft Dark)** | Dim / Evening Rooms | `#1a1c23` | `#b2b8c5` | `#232731` | `#88a2ce` | Soft carbon background and silver-grey text prevent the "haloing" effect common in dark modes. |
| **OLED (Deep Night)** | Pitch Black / In Bed | `#000000` | `#9ca3af` | `#121212` | `#e5e7eb` | Pure black background saves battery; dimmed grey text prevents high-contrast eye fatigue. |

---

## 👁️ UX Improvements for Readability

1. **Glaze/Glow Mitigation**:
   - In Dark/OLED modes, the contrast ratio is kept between `4.5:1` and `7:1` rather than the maximum `21:1` (pure white text on pure black). This stops text from "glowing" or appearing blurry in dark rooms.
2. **Page/Backdrop Blending**:
   - Traditional white manga pages can create a harsh "light bulb" effect when viewed on dark themes.
   - To counter this, a subtle opacity/brightness filter is applied to the manga images when the user switches to **Charcoal** or **OLED Black** mode, softening the white margins while preserving illustration details.
3. **Smooth Color Interpolation**:
   - Transitions between themes are animated using custom cubic-bezier curves (`cubic-bezier(0.25, 0.8, 0.25, 1)`) over `300ms` for a premium, non-jarring theme switch.
