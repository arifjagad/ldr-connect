# CLAUDE.md — LDR-Connect Project Brief

> **Baca file ini terlebih dahulu sebelum menyentuh satu baris kode pun.**
> Dokumen ini adalah satu-satunya sumber kebenaran untuk arsitektur dan konvensi project ini.

---

## 1. Apa Itu LDR-Connect?

**LDR-Connect** adalah platform gaming interaktif untuk pasangan yang menjalani hubungan jarak jauh (Long Distance Relationship). Tujuan utamanya adalah membantu pasangan LDR tetap terhubung dan bersenang-senang melalui permainan bersama secara real-time.

### Target User
- Pasangan yang menjalani LDR (beda kota / beda negara)
- Keduanya harus mendaftar akun dan saling "link" menggunakan **Couple Code**
- Setelah terhubung, mereka bisa bermain game bersama secara online

---

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | **Next.js 16** (App Router) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4** |
| Database | **Supabase (PostgreSQL)** |
| Auth | **Supabase Auth** (email/password) |
| Realtime | **Supabase Realtime** (postgres_changes subscription) |
| State Management | **Zustand** (`stores/`) |
| Payment | **Midtrans** (Snap.js — payment gateway Indonesia) |
| Video Call | **Daily.co** (`@daily-co/daily-js`) |
| Push Notification | **Web Push** (VAPID / `web-push`) |
| AI | **Gemini API** + **OpenRouter API** |
| Game Engine | **Phaser 4** (mini-game Dare Derby, board Snake & Ladder) |
| Validasi | **Zod** |
| Deploy | Netlify (frontend), Supabase cloud (DB + Auth) |

### Versi Penting
- Next.js: `16.2.3` — **BUKAN Next.js 14 atau 15**. App Router tetap dipakai.
- React: `19.2.4`
- Tailwind CSS: `^4` — Sintaks beda dari v3. Tidak ada `tailwind.config.js`; config via `@theme` di CSS.

---

## 3. Struktur Direktori

```
ldr-connect/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page (/)
│   ├── layout.tsx                # Root layout + global providers (Sora + Jakarta Sans)
│   ├── globals.css               # Global styles (Tailwind v4)
│   ├── auth/                     # Halaman login, register
│   ├── dashboard/                # Area utama setelah login
│   │   ├── page.tsx              # Dashboard home (stats, partner, active session, anniversaries, onboarding)
│   │   ├── games/                # Hub game + history
│   │   │   ├── tod/              # Truth or Dare
│   │   │   ├── snake-ladder/     # Ular Tangga
│   │   │   ├── dare-derby/       # Dare Derby
│   │   │   ├── quoridor/         # Quoridor (board 9x9)
│   │   │   ├── stats/            # Statistik couple game
│   │   │   └── history/          # Riwayat game
│   │   ├── coin/                 # Topup coin + redeem voucher + riwayat
│   │   ├── couple/               # Kelola koneksi partner (link/unlink)
│   │   ├── anniversaries/        # Anniversary tracker
│   │   ├── wishlist/             # Bucket list / wishlist bersama
│   │   ├── capsule/              # Time capsule (pesan terjadwal)
│   │   └── profile/              # Edit profil user & avatar
│   ├── join/[code]/              # Deep link join game session
│   ├── admin/                    # Panel admin (is_admin = true)
│   │   ├── dashboard/            # Overview metrics
│   │   ├── users/                # Manajemen user
│   │   ├── questions/            # Approval pertanyaan ToD
│   │   ├── transactions/         # Riwayat transaksi coin
│   │   └── vouchers/             # CRUD voucher
│   └── api/                      # API Routes (~50 endpoints)
│       ├── auth/                 # Login, logout, me (rate limit 2-tier, session age)
│       ├── coin/                 # Topup, verify, webhook, voucher redeem/validate/check
│       ├── couple/               # Link/unlink pasangan
│       ├── game/                 # Game sessions (tod, snake-ladder, dare-derby, quoridor)
│       ├── anniversaries/        # CRUD anniversary
│       ├── wishlist/             # CRUD wishlist + mark done
│       ├── capsule/              # CRUD time capsule + open
│       ├── push/                 # Subscribe & test web push
│       ├── cron/                 # Anniversary reminders & capsule delivery
│       ├── user/                 # Avatar, partner-profile
│       └── admin/                # Admin voucher management
├── components/
│   ├── landing/                  # Komponen landing page
│   ├── games/                    # Komponen game UI (tod, snake-ladder, dare-derby, quoridor)
│   ├── ui/                       # Komponen UI reusable (Toast, Avatar, Select, dll)
│   └── app-shell.tsx             # Shell dengan bottom nav (mobile)
├── hooks/
│   └── usePushSubscription.ts    # Web push notification hook
├── lib/
│   ├── supabase/                 # Supabase client (browser, server, service role)
│   ├── games/                    # Helper logic & validation per game
│   ├── hooks/                    # useCountdown, usePartnerProfile, useServerBalance
│   ├── types.ts                  # TypeScript types global
│   ├── daily.ts                  # Helper Daily.co room
│   ├── push.ts / notifications.ts # Web Push helpers (VAPID)
│   ├── rate-limit.ts             # Rate limiting helper
│   ├── crypto-utils.ts           # Token generator & security helpers
│   └── security-logger.ts        # Audit log security events
├── stores/
│   └── auth-store.ts             # Zustand store (persisted) untuk auth state
├── supabase/
│   ├── migrations/               # SQL migrations (001–030)
│   └── schema/                   # Snapshot schema (01–06)
├── proxy.ts                      # Next.js 16 proxy (auth protect, CSP nonce, session timeout)
└── public/                       # Static assets
```

---

## 4. Database Schema

### Tabel Utama

#### `users`
Profile user. `id` adalah UUID dari `auth.users` Supabase (bukan auto-increment).
```sql
id           UUID PRIMARY KEY  -- UUID dari auth.users
name         VARCHAR(255)
email        VARCHAR(255) UNIQUE
couple_code  VARCHAR(10) UNIQUE  -- Kode 10 karakter untuk link pasangan
partner_id   UUID REFERENCES users(id)  -- NULL jika single
status       VARCHAR(10)  -- 'single' | 'linked'
is_admin     BOOLEAN DEFAULT false
```

#### `wallets`
Saldo coin per user. 1:1 dengan `users`.
```sql
user_id  UUID UNIQUE REFERENCES users(id)
balance  INTEGER >= 0  -- Saldo coin (bukan rupiah!)
```

#### `coin_packages`
Paket top-up coin yang dijual.
```
Starter Pack  → 20 coin  = Rp 15.000
Popular Pack  → 50 coin  = Rp 35.000
Value Pack    → 100 coin = Rp 65.000
Premium Pack  → 200 coin = Rp 120.000
```

#### `coin_transactions`
Riwayat semua pergerakan coin.
```sql
type              VARCHAR  -- 'topup' | 'deduct'
payment_status    VARCHAR  -- 'pending' | 'paid' | 'failed'
payment_reference VARCHAR  -- Midtrans order ID (format: LDR-{userId}-{hex})
metadata          JSONB    -- snap_token, payment_url, response Midtrans
```

#### `game_sessions` ⭐ TABEL PALING PENTING
Satu tabel untuk **semua** jenis game. Game type diidentifikasi oleh kolom `game_type`.
```sql
id               BIGSERIAL PRIMARY KEY
couple_id        UUID  -- SELALU LEAST(host_user_id, partner_user_id)
host_user_id     UUID  -- User yang membuat sesi
partner_user_id  UUID  -- User yang join
session_code     VARCHAR(12) UNIQUE  -- Kode unik, juga sebagai channel Realtime
game_type        VARCHAR  -- 'tod' | 'snake_ladder' | 'dare_derby' | 'quiz'
status           VARCHAR  -- 'waiting' | 'playing' | 'completed' | 'expired' | 'cancelled'
questions        JSONB    -- Array pertanyaan + progress (struktur beda per game)
board_config     JSONB    -- Konfigurasi board (ular/tangga untuk snake, config dare untuk dare_derby)
game_state       JSONB    -- State game saat ini (posisi pion, giliran, skor, dll)
coin_deducted    INTEGER  -- Coin yang sudah dipotong
expires_at       TIMESTAMPTZ  -- Batas waktu partner join
coin_refunded_at TIMESTAMPTZ  -- Timestamp refund (NULL = belum di-refund)
```

#### `game_tod_questions`
Pool pertanyaan Truth or Dare. `couple_id NULL` = pertanyaan global (admin). `couple_id` diisi = pertanyaan custom pasangan.

#### `game_snake_questions`
Pool 100 pertanyaan Truth or Dare khusus untuk game Ular Tangga.

#### `game_dare_questions`
Pool dare untuk game Dare Derby. Kategori: `sweet`, `funny`, `bold`, `challenge`.

#### `game_minigame_configs`
Konfigurasi mini-game untuk Dare Derby. `game_id` contoh: `tap_timing`, `memory_seq`.

#### `anniversaries`
Pengingat hari spesial pasangan (tanggal jadian, anniversary, dll). RLS shared per couple via `couple_id`.

#### `wishlists`
Bucket list / wishlist bersama. Kategori: `virtual`, `offline`, `dream`, `gift`, `other`. Shared per couple.

#### `capsules`
Time capsule — pesan terkunci sampai `delivery_date`. Status: `locked` → `delivered` → `opened`.

#### `vouchers` & `voucher_redemptions`
Sistem voucher promosi. Tipe: `coin_credit` (tambah saldo langsung) dan `topup_discount` (potongan % saat checkout Midtrans).

#### `push_subscriptions`
Endpoint Web Push VAPID per user device untuk background push notifications.

#### `game_settings`
Konfigurasi game: coin cost per sesi, expiry menit.
```
tod          → 1 coin,  expire 10 menit
snake_ladder → 5 coin,  expire 20 menit
dare_derby   → 3 coin,  expire 15 menit
quoridor     → 3 coin,  expire 15 menit
```

#### `admin_activity_logs`
Audit trail untuk security events dan aksi admin.

---

## 5. Konvensi Kritis

### ⚠️ `couple_id` Convention
`couple_id` di `game_sessions` (dan di mana pun) **SELALU** dihitung sebagai:
```sql
couple_id = LEAST(host_user_id, partner_user_id)
```
Ini memastikan dua user yang sama selalu menghasilkan satu `couple_id` yang sama, terlepas dari siapa yang membuat sesi.

### ⚠️ API Response Format
Semua API routes harus mengembalikan format ini:
```typescript
{
  success: boolean;
  message: string;
  data: T;  // null jika tidak ada data
}
```

### ⚠️ Supabase Service Role Key
- **`SUPABASE_SERVICE_ROLE_KEY`** — HANYA digunakan di server-side (API routes). Wajib untuk operasi write yang di-bypass RLS (update wallet, update payment status, dll).
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — Digunakan di client-side. Dibatasi oleh RLS policies.
- **JANGAN PERNAH** expose `SERVICE_ROLE_KEY` ke client/browser.

### ⚠️ Auth Flow
1. User register → Supabase Auth buat entry di `auth.users`
2. Trigger `on_auth_user_created` otomatis buat row di `public.users` + `public.wallets`
3. Semua API routes wajib validasi session via `@supabase/ssr` sebelum proses request

---

## 6. Alur Fitur Utama

### 6.1 Registrasi & Login
```
User daftar (email + password)
  → Supabase Auth buat auth.users
  → Trigger PostgreSQL otomatis buat:
     - public.users (dengan couple_code unik 10 karakter)
     - public.wallets (saldo = 0)
  → User redirect ke /dashboard
```

### 6.2 Couple Linking
```
User A copy Couple Code miliknya
  → Kirim ke User B (via WA, chat, dll)
User B masuk /dashboard/couple
  → Input couple code User A
  → POST /api/couple/link (panggil stored proc link_couple)
  → Stored proc atomic: update partner_id di kedua user, set status = 'linked'
  → Keduanya kini "linked"
```

### 6.3 Top-up Coin
```
User buka /dashboard/coin
  → Pilih paket coin
  → POST /api/coin/topup
     - Buat coin_transaction (status: pending)
     - Minta Snap Token ke Midtrans
     - Return snap_token ke client
  → Client buka Midtrans Snap popup (via NEXT_PUBLIC_MIDTRANS_CLIENT_KEY)
  → User bayar
  → Midtrans kirim webhook ke POST /api/coin/webhook
     - Verifikasi signature Midtrans
     - Panggil stored proc update_payment_status
     - Update coin_transaction.payment_status = 'paid'
     - Tambah wallets.balance
  → User bisa klik "Saya sudah bayar" → GET /api/coin/verify
     - Cek payment_status di DB
     - Jika paid, refresh tampilan saldo
```

### 6.4 Memulai Game (Flow Umum)
```
Host (User A):
  → Buka /dashboard/games → pilih game
  → POST /api/game/{game_type}/session/create
     - Cek apakah ada sesi aktif (tidak boleh double sesi)
     - Panggil stored proc create_game_session:
       · Deduct coin dari wallet (atomic!)
       · Buat baris baru di game_sessions
       · Set expires_at = now() + X menit
     - Return session_code
  → Redirect ke ruang game (menunggu partner)
  → Kirim session_code ke partner (via notifikasi / share)

Partner (User B):
  → Terima session_code
  → POST /api/game/{game_type}/session/join
     - Validasi: sesi harus 'waiting', partner_user_id harus NULL, couple_id cocok
     - Update game_sessions: set partner_user_id, status = 'playing'
  → Supabase Realtime push perubahan ke semua subscriber di channel session_code
  → Host menerima update via Realtime → game mulai
```

---

## 7. Detail Per Game

### 7.1 Truth or Dare (ToD)
- **Coin cost**: 1 coin
- **Expire**: 10 menit menunggu partner
- **Alur gameplay**:
  ```
  Sesi dibuat → questions[] diisi dari pool (mix truth + dare)
  Giliran player: ambil pertanyaan berikutnya dari questions[] yang belum dijawab
  Player memilih Truth atau Dare → pertanyaan ditampilkan
  Selesai → POST /api/game/tod/session/{code}/done → tandai answered, ambil next
  Terus hingga semua pertanyaan selesai → status = 'completed'
  ```
- **Custom questions**: User bisa submit pertanyaan custom → status `is_active = false` (pending approval admin)
- **AI questions**: Generate pertanyaan via Gemini API

**Struktur `questions` JSONB** (array of `TodQuestion`):
```typescript
{
  order: number;
  type: "truth" | "dare";
  question: string | null;
  category: string;
  source: "admin" | "user" | "ai";
  answered_by: string | null;  // UUID user yang menjawab
  is_completed: boolean;
}
```

### 7.2 Snake & Ladder (Ular Tangga)
- **Coin cost**: 5 coin
- **Expire**: 20 menit menunggu partner
- **Alur gameplay**:
  ```
  Sesi dibuat → board_config diisi (posisi ular, tangga, challenge cells)
  Giliran player: roll dadu → POST /api/game/snake/session/{code}/roll
    · Stored proc atomik (atomic via SELECT FOR UPDATE)
    · Hitung posisi baru (termasuk jika kena ular/tangga)
    · Jika kena challenge cell → set pending_challenge di game_state
  Jika ada challenge → POST /api/game/snake/session/{code}/confirm
    · Konfirmasi challenge selesai (atomic)
    · Lanjut giliran berikutnya
  Pemenang: pertama yang mencapai kotak 100
  ```
- **Race condition**: Semua transisi state game dihandle via **stored procedure PostgreSQL** (migration 008) dengan `SELECT ... FOR UPDATE` untuk mencegah race condition.

**Struktur `board_config` JSONB**:
```typescript
{
  snakes: [{ from: number, to: number }];     // from > to
  ladders: [{ from: number, to: number }];    // from < to
  challenges: [{ square: number, type: "truth"|"dare", question: string, category: string }];
}
```

**Struktur `game_state` JSONB**:
```typescript
{
  host_position: number;
  partner_position: number;
  current_turn: "host" | "partner";
  pending_challenge: PendingChallenge | null;
  last_roll: LastRoll | null;
  winner: "host" | "partner" | null;
}
```

### 7.3 Dare Derby
- **Konsep**: Kompetisi mini-game per ronde. Yang kalah di setiap ronde dapat "dare".
- **Alur gameplay**:
  ```
  Sesi dibuat → board_config berisi: total_rounds, dare_level, minigame_sequence
  Setiap ronde:
    1. Pilih mini-game dari minigame_sequence
    2. Kedua player main mini-game (Phaser 4) secara bersamaan
    3. POST /api/game/dare-derby/session/{code}/submit → kirim skor
    4. Yang kalah dapat dare → POST /api/game/dare-derby/session/{code}/dare → konfirmasi
  Setelah semua ronde → status = 'completed', tampilkan scoreboard
  ```
- **Dare levels**: `sweet_only` | `mixed` | `full_chaos`
- **Mini-game types**: `reflex` | `brain` | `skill` (FastestTyper, FlagGuess, MathDash, NumberOrder, dll)
- **Fase game**: `lobby` → `playing` → `result` → `game_over`

**API Endpoints Dare Derby**:
- `POST /api/game/dare-derby/session/create`
- `POST /api/game/dare-derby/session/join`
- `GET  /api/game/dare-derby/session/active`
- `GET  /api/game/dare-derby/session/{code}`
- `POST /api/game/dare-derby/session/{code}/ready`
- `POST /api/game/dare-derby/session/{code}/submit`
- `POST /api/game/dare-derby/session/{code}/dare`
- `POST /api/game/dare-derby/session/{code}/dare/confirm`
- `POST /api/game/dare-derby/session/{code}/dare/complete`
- `POST /api/game/dare-derby/session/{code}/dare/skip`
- `POST /api/game/dare-derby/session/{code}/surrender`
- `GET  /api/game/dare-derby/session/{code}/room` (Daily.co room)

### 7.4 Quoridor (Game Board Strategi)
- **Coin cost**: 3 coin
- **Expire**: 15 menit menunggu partner
- **Konsep**: Board game strategi 9×9. Tujuan: pion Host mencapai baris 8 (bawah), pion Partner mencapai baris 0 (atas).
- **Mekanik**:
  - Giliran player: pilih **MOVE** (geser 1 langkah orthogonal) atau **WALL** (pasang tembok 2-blok horisontal/vertikal).
  - Setiap player punya jatah tembok (default 10 buah).
  - Tembok tidak boleh memblokir total jalan lawan ke garis finis (pathfinding A* / BFS validation server-side).
  - Jump rules: lompat pion lawan jika berhadapan.
- **Race condition**: Semua mutasi move/wall divalidasi dan dijalankan via API server-side `POST /api/game/quoridor/session/{code}/action`.

**API Endpoints Quoridor**:
- `POST /api/game/quoridor/session/create`
- `POST /api/game/quoridor/session/join`
- `GET  /api/game/quoridor/session/active`
- `GET  /api/game/quoridor/session/{code}`
- `POST /api/game/quoridor/session/{code}/action` (move/wall)
- `POST /api/game/quoridor/session/{code}/surrender`
- `POST /api/game/quoridor/session/{code}/expire`
- `GET  /api/game/quoridor/session/{code}/room` (Daily.co room)

---

## 8. Realtime (Supabase)

Tabel `game_sessions` sudah di-publish ke `supabase_realtime`. Subscribe dari client:

```typescript
const channel = supabase
  .channel(`game-session-${sessionCode}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'game_sessions',
    filter: `session_code=eq.${sessionCode}`,
  }, (payload) => {
    // payload.new = data sesi terbaru (full row)
    // Update local state dari sini
  })
  .subscribe();

// PENTING: cleanup saat unmount
return () => { supabase.removeChannel(channel); };
```

---

## 9. Video Call (Daily.co)

Setiap game session bisa membuka video call. Flow:
```
POST /api/game/{type}/session/{code}/room
  → Buat Daily.co room via API (GET atau CREATE)
  → Return room URL
Client load <VideoCall roomUrl={url} />
  → Komponen VideoCall.tsx menggunakan @daily-co/daily-js
```

Env yang dibutuhkan:
- `DAILY_API_KEY` — Server only
- `NEXT_PUBLIC_DAILY_DOMAIN` — Domain Daily.co (format: `yourapp.daily.co`)

---

## 10. Stored Procedures Utama

Semua operasi kompleks (yang butuh atomicity) dijalankan via stored procedures PostgreSQL, dipanggil dengan `supabase.rpc()`.

| Procedure | File Migration | Dipanggil dari |
|---|---|---|
| `link_couple(user_id, couple_code)` | 003 | `POST /api/couple/link` |
| `unlink_couple(user_id)` | 003 | `POST /api/couple/unlink` |
| `create_game_session(...)` | 003 | `POST /api/game/*/session/create` |
| `join_game_session(...)` | 003 | `POST /api/game/*/session/join` |
| `update_payment_status(...)` | 003 | `POST /api/coin/webhook` |
| `roll_snake_dice(...)` | 008 | `POST /api/game/snake/session/{code}/roll` |
| `confirm_snake_challenge(...)` | 008 | `POST /api/game/snake/session/{code}/confirm` |
| `cancel_game_session(...)` | 008 | `POST /api/game/tod/session/{code}/cancel` |
| `expire_waiting_sessions()` | 003 | Cron / scheduled trigger |

---

## 11. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=         # Client-side OK
SUPABASE_SERVICE_ROLE_KEY=             # SERVER ONLY — jangan expose ke client!

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Midtrans
MIDTRANS_SERVER_KEY=                   # SERVER ONLY
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=       # Client-side OK
MIDTRANS_IS_PRODUCTION=false           # true untuk production

# AI (opsional)
GEMINI_API_KEY=                        # SERVER ONLY
OPENROUTER_API_KEY=                    # SERVER ONLY

# Daily.co (video call)
DAILY_API_KEY=                         # SERVER ONLY
NEXT_PUBLIC_DAILY_DOMAIN=              # yourapp.daily.co
```

---

## 12. Penting untuk Claude

### Hal yang TIDAK BOLEH diubah
- Nama tabel dan kolom di database — sudah production
- Konvensi `couple_id = LEAST(user_id, partner_id)`
- Format response API: `{ success, message, data }`
- Logika deduct coin di `create_game_session` — ini stored procedure, atomik

### Hal yang Perlu Diperhatikan
- **Next.js versi 16** — Baca `node_modules/next/dist/docs/` jika ragu tentang API
- **React 19** — Beberapa API berbeda dari React 18 (misalnya penggunaan hooks)
- **Tailwind v4** — Tidak ada `tailwind.config.js`. Config via `@theme {}` di CSS. Kelas seperti `bg-linear-to-br` bukan `bg-gradient-to-br`.
- **Supabase client di server** — Selalu gunakan `createServerClient` dari `@supabase/ssr` (bukan `createClient` biasa) untuk API routes dan server components
- **`SUPABASE_SERVICE_ROLE_KEY`** — Hanya untuk API routes yang butuh bypass RLS. Jangan pernah kirim ke client.

### Cara Buat API Route Baru
```typescript
// app/api/example/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // untuk write operations
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  // Selalu validasi auth dulu
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthorized", data: null }, { status: 401 });
  }

  // ... logic
  return NextResponse.json({ success: true, message: "OK", data: result });
}
```

### Cara Subscribe Realtime
Lihat bagian [Section 8](#8-realtime-supabase). Selalu cleanup channel saat komponen unmount.

### Security yang Sudah Diimplementasikan
- CSP dengan nonce-based (bukan `unsafe-inline`) via `middleware.ts`
- HSTS header
- Rate limiting via `lib/rate-limit.ts`
- Security event logging via `lib/security-logger.ts`
- Semua payment route: `Cache-Control: no-store`
- Order ID Midtrans pakai `crypto.randomBytes(4).toString("hex")` (bukan `Math.random`)
- Snake game & cancel session: operasi atomic via stored procedure

---

## 13. Fitur Dashboard

| Halaman | Path | Deskripsi |
|---|---|---|
| Dashboard Home | `/dashboard` | Overview: saldo coin, status couple, partner, upcoming anniversaries, active session banner, onboarding checklist |
| Games Hub | `/dashboard/games` | Daftar semua game yang tersedia |
| Truth or Dare | `/dashboard/games/tod` | Gameplay Truth or Dare |
| ToD Questions | `/dashboard/games/tod/questions` | Submit pertanyaan custom ToD |
| Ular Tangga | `/dashboard/games/snake-ladder` | Gameplay Ular Tangga (Phaser 4) |
| Dare Derby | `/dashboard/games/dare-derby` | Mini-game competition |
| Quoridor | `/dashboard/games/quoridor` | Board game strategi 9×9 |
| Game Stats | `/dashboard/games/stats` | Statistik couple game (win/loss, match count) |
| Game History | `/dashboard/games/history` | Riwayat game sesi sebelumnya |
| Coin Topup | `/dashboard/coin` | Beli coin via Midtrans + redeem voucher + riwayat |
| Couple Connection | `/dashboard/couple` | Link/unlink partner via couple code |
| Anniversary Tracker | `/dashboard/anniversaries` | Buat & kelola pengingat hari spesial |
| Wishlist | `/dashboard/wishlist` | Bucket list bersama (virtual/offline/dream/gift) |
| Time Capsule | `/dashboard/capsule` | Pesan terjadwal antar pasangan |
| Profile | `/dashboard/profile` | Edit nama, avatar |
| Admin Panel | `/admin` | Kelola questions, users, transaksi, voucher (is_admin only) |

---

## 14. Migrasi Database

File migration di `supabase/migrations/` dijalankan **secara berurutan** di Supabase SQL Editor:

| File | Isi |
|---|---|
| `001_tables.sql` | Semua tabel, index, triggers, seed game_settings & coin_packages |
| `002_rls_policies.sql` | Row Level Security policies |
| `003_functions.sql` | Stored functions (business logic utama) |
| `004_tod_questions_seed.sql` | Seed ~60 pertanyaan Truth or Dare |
| `005_snake_questions_seed.sql` | Seed ~100 pertanyaan Ular Tangga |
| `006_snake_use_game_sessions.sql` | Migrasi snake ke unified game_sessions |
| `007_fix_create_game_session_ambiguity.sql` | Fix ambiguity di stored proc |
| `008_atomic_snake_and_cancel.sql` | Stored proc atomic untuk snake & cancel |
| `009_drop_deprecated_snake_functions.sql` | Drop fungsi snake lama |
| `010_rate_limiting.sql` | Tabel & fungsi rate limiting |
| `011_enforce_session_expiry.sql` | Enforce expiry & auto-expire sessions |
| `012_fix_active_session_check.sql` | Fix cek sesi aktif |
| `013_fix_active_session_gametype.sql` | Fix game type di cek sesi aktif |
| `014_dare_derby_tables.sql` | Tabel Dare Derby (dare_questions, minigame_configs) |
| `015_dare_derby_functions.sql` | Stored functions Dare Derby |
| `016_dare_derby_seed.sql` | Seed data dare questions & minigame configs |
| `017_fix_select_dare_derby_minigames.sql` | Fix query select minigames |
| `018_fix_confirm_dare_next_round.sql` | Fix logic confirm dare & next round |
| `019_add_number_order_minigame.sql` | Tambah mini-game number order |
| `020_anniversaries_shared_couple.sql` | Policy anniversaries shared couple |
| `020_vouchers.sql` | Tabel vouchers + voucher_redemptions |
| `020b_vouchers_seed.sql` | Seed sample vouchers |
| `021_anniversaries_couple_update.sql` | Trigger auto-update couple anniversaries |
| `021_discount_vouchers.sql` | Dukungan voucher topup discount |
| `022_wishlists.sql` | Tabel wishlists + RLS + trigger |
| `023_capsules.sql` | Tabel capsules + RLS |
| `024_quoridor.sql` | Game settings Quoridor |
| `025_quoridor_fix.sql` | Stored procedures Quoridor gameplay |
| `026_quoridor_pathcheck.sql` | Validasi pathfinding Quoridor (BFS) |
| `027_quoridor_fix_jump.sql` | Fix rule lompat bidak Quoridor |
| `028_login_rate_limit.sql` | Rate limiting login 2-tier di DB |
| `029_capsules.sql` | Capsule enhancement + unlock procedures |
| `030_add_new_minigames.sql` | Mini-game baru Dare Derby |
| `add_avatar_url.sql` | Kolom avatar_url di users |
| `push_subscriptions.sql` | Tabel push_subscriptions |

> **JANGAN menjalankan migration yang sama dua kali.** Gunakan `IF NOT EXISTS` atau `ON CONFLICT DO NOTHING` saat menambah migration baru.

---

## 15. Cron Jobs (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/anniversary-reminders",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/capsule-delivery",
      "schedule": "0 0 * * *"
    }
  ]
}
```
- Endpoint dilindungi via header `Authorization: Bearer ${CRON_SECRET}`.
- `anniversary-reminders`: Push notif H-7, H-3, H-1, dan hari-H anniversary.
- `capsule-delivery`: Unlock pesan time capsule yang `delivery_date <= today`, kirim push notif ke penerima.
