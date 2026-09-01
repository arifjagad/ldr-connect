# LDR-Connect Design System

Dokumentasi resmi token desain, palet warna, tipografi, dan spesifikasi komponen editorial LDR-Connect (Landing Page & Auth).

---

## 1. Color Palette & Tokens

### Primary & Brand Colors
| Token Name | Hex Code | Figma Code | Tailwind / CSS Variable | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Ground Background** | `#FCFBF7` | `#FCFBF7` | `--background` / `bg-[#FCFBF7]` | Background utama halaman, input default |
| **Surface / Card** | `#FFFFFF` | `#FFFFFF` | `--surface` / `bg-white` | Background card, modal, container form |
| **Terracotta (Brand)** | `#C84B31` | `#D35245` | `--terracotta` / `bg-[#C84B31]` | Tombol utama, logo icon, highlight text |
| **Terracotta Hover** | `#B33E26` | `#B33E26` | `--terracotta-hover` | Hover state tombol utama |
| **Terracotta Light** | `#FDF4F2` / `#FBF0ED` | `#F8EFE9` | `--terracotta-light` | Background badge pill, stats section tint |

### Neutral & Text Colors
| Token Name | Hex Code | Figma Code | Tailwind / CSS Variable | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Foreground (Dark)** | `#1F1D1B` | `#221A18` | `--foreground` / `text-[#1F1D1B]` | Heading, body text utama, label input |
| **Text Muted** | `#78716C` | `#685F5C` | `--text-muted` / `text-[#78716C]` | Subtitle, deskripsi, placeholder secondary |
| **Text Subtle / Placeholder**| `#A8A29E` | `#A8A29E` | `placeholder-[#A8A29E]` | Placeholder form input |
| **Border Neutral** | `#E7E5E4` | `#E9E3D8` | `--border-color` / `border-[#E7E5E4]` | Border card, divider, input border |
| **Border Subtle** | `#F5F5F4` | `#F5F5F4` | `border-[#F5F5F4]` | Inner card border, icon box outline |

### Accent & Status Colors
| Token Name | Hex Code | Background Tint | Penggunaan |
| :--- | :--- | :--- | :--- |
| **Success / Online** | `#1D7D1D` / `#10B981` | `#EBF9EB` | Status active / online, badge verified |
| **Warning / Coin** | `#D97706` / `#F59E0B` | `#FEF3C7` | Tag koin, pending transaction |
| **Accent Blue** | `#2563EB` / `#4E8ED3` | `#EFF6FF` | Feature tags, games type tag |
| **Accent Purple** | `#818CF8` | `#EEF2FF` | Category tags |

---

## 2. Typography System

### Font Families
* **Display / Editorial**: `Instrument Serif` (Figma) / `Newsreader` (Web: `.font-editorial`, `--font-serif`)
* **Body / UI**: `Geist` (Figma) / `Plus Jakarta Sans` (Web: `--font-jakarta`, `font-sans`)
* **Monospace**: `Geist Mono` (Web: `--font-mono`)

### Typographic Hierarchy
| Hierarchy Level | Font Family | Size (Desktop / Mobile) | Weight | Line Height | Tracking | Penggunaan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | Editorial Serif | `56px - 76px` / `40px` | Regular (400) | `1.05 - 1.15` | `-0.02em` | Hero heading landing page |
| **Heading 1 / Title**| Editorial Serif | `32px - 40px` / `28px` | Regular (400) | `1.2` | `-0.02em` | Judul card auth, modal title |
| **Heading 2 / Section**| Editorial Serif | `24px - 32px` / `22px` | Regular (400) | `1.25` | `-0.01em` | Judul section, games title |
| **Heading 3 / Subtitle**| Sans-Serif | `16px - 18px` | Bold (700) | `1.3` | `normal` | Judul game card, sub-heading |
| **Body Standard** | Sans-Serif | `14px - 15px` | Regular (400) | `1.5 - 1.6` | `normal` | Paragraf umum, deskripsi |
| **Body Small** | Sans-Serif | `12px - 13px` | Regular / Medium | `1.4` | `normal` | Form input, label form, secondary info |
| **Caption / Price** | Sans-Serif | `11px` | Medium (500) | `1.3` | `normal` | Metadata, harga game, hint |
| **Badge / Pill Tag** | Sans-Serif | `10px - 11px` | SemiBold (600) | `1.0` | `+0.05em` | Pill badge kategori (Uppercase) |

---

## 3. Component Specifications

### A. Surface & Cards
* **Card Container**:
  * Background: `#FFFFFF`
  * Border: `1px solid #E7E5E4`
  * Border Radius: `rounded-2xl` (`16px` - `20px`)
  * Box Shadow: `shadow-xl shadow-black/[0.03]` atau `shadow-xs hover:shadow-md`
  * Padding: `p-6` s/d `p-10`

### B. Badge & Chips (Pill)
* **Design**:
  * Shape: `rounded-full`
  * Fill: `#FDF4F2` (`--terracotta-light`)
  * Border: `1px solid #E7E5E4`
  * Typography: `10px` / `11px`, `font-semibold`, uppercase, `tracking-wider`
  * Text Color: `#C84B31` (`--terracotta`)
  * Padding: `px-3 py-1`

### C. Buttons
* **Primary Button**:
  * Background: `#C84B31`
  * Hover Background: `#B33E26`
  * Text: White (`#FFFFFF`), `text-xs font-semibold`
  * Shape: `rounded-lg` (`8px`) atau `rounded-full`
  * Padding: `px-4 py-3`
  * Shadow: `shadow-xs`
* **Navigation / Icon Controls**:
  * Size: `h-10 w-10`
  * Shape: `rounded-full`
  * Background: `#FFFFFF`, Hover: `#FCFBF7`
  * Border: `1px solid #E7E5E4`
  * Disabled State: `opacity-30 cursor-not-allowed`

### D. Form Inputs
* **Input Field**:
  * Background: `#FCFBF7` (default), `#FFFFFF` (focus)
  * Border: `1px solid #E7E5E4` (default), `focus:border-[#C84B31]`
  * Text: `text-xs text-[#1F1D1B]`
  * Placeholder: `text-[#A8A29E]`
  * Radius: `rounded-lg` (`8px`)
  * Padding: `px-3.5 py-2.5`
  * Outline: `outline-none`

### E. Carousel & Showcase Cards
* **Container**: `flex gap-6 overflow-x-auto snap-x snap-mandatory`
* **Card Dimensions**: `min-w-[280px] sm:min-w-[320px] md:min-w-[350px] max-w-[380px]`
* **Icon Box**: `h-20 w-full rounded-xl bg-[#FCFBF7] border border-[#F5F5F4]`
* **Divider**: `border-t border-[#F5F5F4] pt-4`

---

## 4. CSS Variable Setup (`app/globals.css`)

```css
:root {
  --background: #FCFBF7;
  --foreground: #1F1D1B;
  --surface: #FFFFFF;
  --terracotta: #C84B31;
  --terracotta-hover: #B33E26;
  --terracotta-light: #FBF0ED;
  --text-muted: #78716C;
  --border-color: #E7E5E4;
}
```
