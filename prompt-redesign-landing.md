# Prompt: Redesign Landing Page LDR-Connect

Paste prompt ini langsung ke Claude Code di VS Code.

---

## PROMPT

Redesign the landing page of LDR-Connect to look premium, modern, and human-crafted — not AI-generated. This is a romantic couple gaming platform for long-distance relationships.

### Design Direction
- **Mood**: Intimate, warm, romantic — like a late-night date
- **Style**: Modern editorial, clean, high-end SaaS meets lifestyle brand
- **NOT**: Generic gradient soup, cookie-cutter AI layouts, neon glow overload

### Color Palette (strict — do not deviate)
```
Primary pink:     #FF3D7F   (CTA buttons, accents)
Pink light:       #FF6B9D   (hover states, highlights)
Pink muted:       #FFB3CC   (subtle tints, borders)
Dark base:        #0D0D0F   (main background)
Dark surface:     #141417   (cards, nav)
Dark elevated:    #1C1C21   (hover cards, modals)
Text primary:     #F5F0FF   (headings)
Text secondary:   #9B93B0   (body, subtitles)
Text muted:       #5C5470   (labels, captions)
```

### Typography Rules
- Headings: `font-bold tracking-tight leading-[1.1]` — tight and editorial
- Hero headline: minimum `text-6xl lg:text-8xl` — big and confident
- Body: `text-base leading-relaxed text-[#9B93B0]`
- Labels/badges: `text-xs font-semibold uppercase tracking-widest`
- Never use generic `font-sans` — import and use `Inter` or `Plus Jakarta Sans` from Google Fonts

### Layout Rules
- Max content width: `max-w-7xl mx-auto px-6 lg:px-8`
- Section spacing: `py-24 lg:py-32` between sections
- NO full-width gradient backgrounds — use dark base `#0D0D0F` with subtle radial glows
- Radial glow technique: `bg-[radial-gradient(ellipse_at_top_left,_#FF3D7F15_0%,_transparent_60%)]`
- Cards: `bg-[#141417] border border-[#FF3D7F15] rounded-2xl` — minimal border, no heavy shadows

### Sections to Build (in order)

**1. Navbar**
- Logo left: "LDR-Connect" in `text-white font-bold` with a small pink heart dot
- Right: "Masuk" (ghost) + "Daftar" (pink filled pill button)
- Sticky, `backdrop-blur-md bg-[#0D0D0F]/80 border-b border-white/5`

**2. Hero Section**
- Left: badge pill → big headline → subtext → two CTA buttons → small social proof ("500+ pasangan aktif")
- Right: floating game card UI mockup (show Truth or Dare card with question and two player avatars)
- Badge: `PLATFORM #1 UNTUK PASANGAN LDR` in pink pill
- Headline: "Main bareng,\nwalau beda\nkota." — each line can have different color treatment
- Word "bareng" or "beda kota" in `text-[#FF3D7F]`
- Primary CTA: "Mulai Sekarang →" pink filled
- Secondary CTA: "Lihat Demo" ghost with arrow

**3. How It Works (3 steps)**
- Horizontal 3-column on desktop, vertical on mobile
- Step numbers: large `text-8xl font-black text-[#FF3D7F]/10` behind the content (decorative)
- Cards with left accent border: `border-l-2 border-[#FF3D7F]`
- Steps: "Daftar & Link Pasangan" → "Beli Coin" → "Pilih Game & Main"

**4. Featured Games**
- Section label: "GAME TERSEDIA"
- Headline: "Satu platform,\nbanyak cara\ndekat."
- Game cards (horizontal layout on desktop):
  - Truth or Dare: pink badge "TERSEDIA", description, "1 Coin / Sesi"
  - Snake & Ladder Date Night: gray badge "SEGERA", blurred/locked treatment
  - Couple Quiz Battle: gray badge "SEGERA", blurred/locked treatment
- Cards: `rounded-2xl bg-[#141417] border border-[#1C1C21] hover:border-[#FF3D7F30] transition-all`

**5. Coin System Section**
- Dark card with pink accent
- Headline: "Bayar hanya saat mau main."
- Subtext explaining coin flexibility vs subscription
- Show 4 coin packages as pills: "20 Coin — Rp20.000", "50 Coin — Rp45.000", etc.
- Highlight the middle package with pink border

**6. Footer**
- Minimal: logo left, nav links center, "© 2025 LDR-Connect" right
- `border-t border-white/5 py-8`

### Component Standards
```tsx
// Primary button
className="bg-[#FF3D7F] hover:bg-[#FF6B9D] text-white font-semibold px-6 py-3 rounded-full transition-all duration-200 hover:scale-[1.02]"

// Ghost button
className="border border-white/20 hover:border-white/40 text-white font-semibold px-6 py-3 rounded-full transition-all duration-200"

// Badge/label pill
className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#FF6B9D] bg-[#FF3D7F10] border border-[#FF3D7F20] px-4 py-2 rounded-full"

// Game card
className="bg-[#141417] border border-[#1C1C21] hover:border-[#FF3D7F30] rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
```

### What to AVOID
- No heavy drop shadows (`shadow-2xl` on everything)
- No `from-purple-900 via-pink-900 to-black` gradient backgrounds
- No glowing neon borders
- No stock-photo placeholder images — use simple SVG shapes or CSS-only mockups
- No centered hero with just a big button — use asymmetric layouts
- No ALL CAPS headings on hero
- No generic "Selamat datang di LDR-Connect" copy

### File Structure
- Edit `app/page.tsx` (or `pages/index.tsx` depending on project structure)
- Create reusable components in `components/landing/`:
  - `Navbar.tsx`
  - `HeroSection.tsx`
  - `HowItWorks.tsx`
  - `FeaturedGames.tsx`
  - `CoinSection.tsx`
  - `Footer.tsx`
- All styling via Tailwind utility classes only — no separate CSS files

### Final Check Before Done
- [ ] Mobile responsive (test at 375px width)
- [ ] No Lorem Ipsum — all copy in Bahasa Indonesia
- [ ] Hover states on all interactive elements
- [ ] Consistent spacing — no random padding values
- [ ] Dark mode looks great (it's already dark theme)
