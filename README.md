<div align="center">

# 💕 LDR-Connect

**Platform gaming interaktif untuk pasangan jarak jauh.**  
Mainkan game bersama, kumpulkan coin, dan jaga koneksi kalian — walau berjauhan.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)

</div>

---

## ✨ Tentang LDR-Connect

LDR-Connect adalah web app untuk pasangan yang menjalani **hubungan jarak jauh (LDR)**. Dua user bisa saling terhubung menggunakan **Couple Code**, lalu bermain game bersama secara real-time — dari mana saja.

---

## 🎮 Game yang Tersedia

| Game | Coin | Deskripsi |
|------|------|-----------|
| 🃏 **Truth or Dare** | 1 coin | Jawab pertanyaan jujur atau terima tantangan |
| 🐍 **Ular Tangga** | 5 coin | Board game klasik dengan challenge Truth or Dare di tiap kotak |
| 🏁 **Dare Derby** | 5 coin | Kompetisi mini-game seru — yang kalah dapat dare! |

---

## 🚀 Fitur Utama

- **Couple Linking** — Hubungkan akun dengan pasangan via kode unik 10 karakter
- **Coin System** — Beli coin pakai Midtrans (payment gateway Indonesia), pakai coin untuk main game
- **Real-time Sync** — Gerakan & aksi dalam game langsung tersinkron via Supabase Realtime
- **Video Call** — Ngobrol sambil main via Daily.co (in-app video call)
- **Anniversary Tracker** — Catat dan pantau momen spesial kalian
- **AI Questions** — Pertanyaan Truth or Dare di-generate via Gemini AI
- **Admin Panel** — Kelola pertanyaan, user, dan transaksi

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
| Payment | Midtrans (Snap.js) |
| Video Call | Daily.co |
| AI | Gemini API + OpenRouter |
| Mini-game Engine | Phaser 4 |
| State Management | Zustand |
| Validation | Zod |
| Deploy | Netlify |

---

## ⚙️ Setup & Instalasi

### Prerequisites
- Node.js 18+
- Akun [Supabase](https://supabase.com) (database + auth)
- Akun [Midtrans](https://midtrans.com) (payment, sandbox gratis)
- Akun [Daily.co](https://daily.co) (video call, opsional)

### 1. Clone & Install

```bash
git clone https://github.com/arifjagad/ldr-connect-new.git
cd ldr-connect-new
npm install
```

### 2. Konfigurasi Environment

Salin file contoh lalu isi dengan value kamu:

```bash
cp .env.local.example .env.local
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Midtrans
MIDTRANS_SERVER_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

# AI (opsional)
GEMINI_API_KEY=
OPENROUTER_API_KEY=

# Daily.co (opsional)
DAILY_API_KEY=
NEXT_PUBLIC_DAILY_DOMAIN=
```

### 3. Setup Database

Jalankan semua file migration di **Supabase SQL Editor** secara berurutan:

```
supabase/migrations/001_tables.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_functions.sql
supabase/migrations/004_tod_questions_seed.sql
supabase/migrations/005_snake_questions_seed.sql
... (lanjutkan sampai 019)
```

> Lihat `supabase/README.md` untuk panduan lengkap urutan migration.

### 4. Jalankan Dev Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 🗂️ Struktur Project

```
ldr-connect/
├── app/                  # Next.js App Router (pages + API routes)
│   ├── api/              # Backend API (coin, game, couple, auth)
│   ├── dashboard/        # Area utama setelah login
│   └── game/             # Game rooms (gameplay aktif)
├── components/           # React components (UI, game, landing)
├── lib/                  # Helper & utilities (supabase client, types, dll)
├── stores/               # Zustand stores (auth state)
├── supabase/             # SQL migrations & schema
└── public/               # Static assets
```

---

## 💰 Paket Coin

| Paket | Coin | Harga |
|-------|------|-------|
| Starter Pack | 20 coin | Rp 15.000 |
| Popular Pack | 50 coin | Rp 35.000 |
| Value Pack | 100 coin | Rp 65.000 |
| Premium Pack | 200 coin | Rp 120.000 |

---

## 🔐 Keamanan

Project ini sudah menerapkan berbagai praktik keamanan (OWASP):

- ✅ Nonce-based CSP (tidak menggunakan `unsafe-inline`)
- ✅ HSTS header
- ✅ Atomic database operations (mencegah race condition)
- ✅ Ownership check pada setiap transaksi
- ✅ Cryptographically secure order ID (bukan `Math.random`)
- ✅ Cache-Control `no-store` untuk halaman payment
- ✅ Security event logging

---

## 📄 Dokumentasi untuk Developer / AI

Jika kamu adalah developer baru atau AI assistant yang akan bekerja di codebase ini, baca:

- **[`CLAUDE.md`](./CLAUDE.md)** — Panduan teknis lengkap: arsitektur, konvensi kode, alur game, API routes, dan hal-hal penting yang tidak boleh diubah.
- **[`supabase/README.md`](./supabase/README.md)** — Panduan urutan migration dan struktur database.

---

## 🧑‍💻 Author

**Arif Jagad** — [@arifjagad](https://github.com/arifjagad)

---

<div align="center">

Made with ❤️ for couples in long distance relationships

</div>
