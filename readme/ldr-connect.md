# 📖 LDR-Connect — Documentation & System Architecture Guide

> Dokumen ini berisi panduan teknis mendalam dan penjelasan sistem kerja LDR-Connect secara terperinci.

---

## 1. Overview & Konsep Utama

**LDR-Connect** adalah platform gaming interaktif real-time khusus pasangan hubungan jarak jauh (Long Distance Relationship / LDR). Platform ini memungkinkan pasangan terhubung secara virtual, bermain game interaktif, mengumpulkan coin, serta menjaga interaksi emosional melalui in-app video call dan tracker momen spesial.

### Alur Utama Pengguna (User Journey)
1. **Registrasi Account**: User mendaftar via Supabase Auth (email & password).
2. **Couple Linking**: User mendapatkan `couple_code` unik (10 karakter), membagikannya ke pasangan, dan menautkan akun.
3. **Top-Up Coin**: User membeli coin via payment gateway Midtrans untuk modal bermain game.
4. **Create/Join Game Session**: Salah satu user (Host) membuat sesi game, memotong coin, dan mengundang Partner. Partner bergabung via Realtime update.
5. **Gameplay & Video Call**: Kedua user bermain game secara bersamaan sambil berkomunikasi via Daily.co Video Call.

---

## 2. Tech Stack & Ekosistem

| Layer | Teknologi | Deskripsi / Pengunaan |
|---|---|---|
| **Framework** | Next.js 16.2.3 | App Router (`/app`), React 19 (`19.2.4`) |
| **Language** | TypeScript 5 | Strict typing di seluruh codebase |
| **Styling** | Tailwind CSS v4 | Styling berbasis `@theme` di `globals.css` (tanpa `tailwind.config.js`) |
| **Database & Auth** | Supabase | PostgreSQL, Supabase Auth, RLS Policies, Database Triggers |
| **Realtime Engine** | Supabase Realtime | Subscription `postgres_changes` pada channel `session_code` |
| **Payment Gateway**| Midtrans Snap.js | Integrasi pembayaran lokal (QRIS, GoPay, Bank Transfer) |
| **Video Call** | Daily.co (`@daily-co/daily-js`) | WebRTC video/audio call terintegrasi dalam game room |
| **Mini-Game Engine**| Phaser 4 | Digunakan pada Dare Derby untuk mini-game interaktif |
| **State Management**| Zustand | Managed global store (`stores/auth-store.ts`) |
| **AI Integration** | Gemini API & OpenRouter | Auto-generate pertanyaan Truth or Dare kontekstual |
| **Validation** | Zod | Schema validation pada request API & input form |
| **Deployment** | Netlify / Supabase Cloud | Frontend di Netlify, Database & Auth di Supabase Cloud |

---

## 3. Arsitektur Database & Schema

### Konvensi Kritis: `couple_id`
Setiap baris game session atau data berpasangan diidentifikasi oleh `couple_id`. Nilai ini **WAJIB** dihitung secara konsisten menggunakan formula:
```sql
couple_id = LEAST(host_user_id, partner_user_id)
```
*Tujuan*: Menjamin dua user terhubung selalu menghasilkan satu identifier yang sama persis tanpa tergantung siapa yang menginisiasi sesi.

---

### Struktur Tabel Utama

#### 1. `users`
Menyimpan profil pengguna. Primary Key (`id`) terikat 1:1 dengan `auth.users` Supabase.
- `id` (`UUID`, PK) -> References `auth.users(id)`
- `name` (`VARCHAR(255)`) -> Nama lengkap / panggilan user
- `email` (`VARCHAR(255)`, UNIQUE) -> Email terdaftar
- `couple_code` (`VARCHAR(10)`, UNIQUE) -> Kode unik 10 karakter untuk proses linking
- `partner_id` (`UUID`, NULLABLE) -> References `users(id)`
- `status` (`VARCHAR(10)`) -> `'single'` | `'linked'`
- `is_admin` (`BOOLEAN`, DEFAULT `false`) -> Flag hak akses admin panel

#### 2. `wallets`
Menyimpan saldo coin per pengguna (1:1 dengan `users`).
- `user_id` (`UUID`, PK, UNIQUE) -> References `users(id)`
- `balance` (`INTEGER`, CHECK `>= 0`) -> Saldo coin aktif

#### 3. `coin_packages`
Daftar paket coin yang dapat dibeli.
- `id` (`BIGSERIAL`, PK)
- `name` (`VARCHAR`) -> Contoh: Starter Pack, Popular Pack
- `coins` (`INTEGER`) -> Jumlah coin yang didapat
- `price_idr` (`INTEGER`) -> Harga dalam Rupiah

#### 4. `coin_transactions`
Riwayat transaksi pembelian dan penggunaan coin.
- `id` (`BIGSERIAL`, PK)
- `user_id` (`UUID`) -> References `users(id)`
- `package_id` (`BIGSERIAL`) -> References `coin_packages(id)`
- `amount` (`INTEGER`) -> Jumlah coin
- `type` (`VARCHAR`) -> `'topup'` | `'deduct'`
- `payment_status` (`VARCHAR`) -> `'pending'` | `'paid'` | `'failed'`
- `payment_reference` (`VARCHAR`, UNIQUE) -> Format order ID Midtrans (`LDR-{userId}-{hex}`)
- `metadata` (`JSONB`) -> Menyimpan Snap Token, URL pembayaran, dan response raw Midtrans

#### 5. `game_sessions` (Unified Game Table)
Satu tabel terpusat untuk mengelola seluruh jenis game (`tod`, `snake_ladder`, `dare_derby`).
- `id` (`BIGSERIAL`, PK)
- `session_code` (`VARCHAR(12)`, UNIQUE) -> Kode unik room & nama channel Realtime
- `couple_id` (`UUID`) -> `LEAST(host_user_id, partner_user_id)`
- `host_user_id` (`UUID`) -> User pembuat sesi
- `partner_user_id` (`UUID`, NULLABLE) -> User yang join sesi
- `game_type` (`VARCHAR`) -> `'tod'` | `'snake_ladder'` | `'dare_derby'`
- `status` (`VARCHAR`) -> `'waiting'` | `'playing'` | `'completed'` | `'expired'` | `'cancelled'`
- `questions` (`JSONB`) -> Array pertanyaan & status jawaban
- `board_config` (`JSONB`) -> Konfigurasi papan game (ular/tangga/mini-game sequence)
- `game_state` (`JSONB`) -> State runtime (posisi pion, giliran aktif, skor, ronde)
- `coin_deducted` (`INTEGER`) -> Jumlah coin yang dipotong dari host
- `expires_at` (`TIMESTAMPTZ`) -> Batas waktu penungguan partner
- `coin_refunded_at` (`TIMESTAMPTZ`, NULLABLE) -> Timestamp pengembalian coin jika expired/cancelled

---

## 4. Sistem Auth & Security Architecture

### Auth Flow
1. **User Sign Up / Sign In**:
   Client memanggil `@supabase/ssr` via Supabase Auth API.
2. **Database Trigger Triggers**:
   Saat baris `auth.users` tercipta, PostgreSQL Trigger `on_auth_user_created` otomatis membuat:
   - Baris di `public.users` dengan `couple_code` acak 10 karakter.
   - Baris di `public.wallets` dengan `balance = 0`.
3. **Session Validation**:
   Semua API route memverifikasi token session via `createServerClient` dari `@supabase/ssr`.

### Keamanan (OWASP Standard)
- **CSP Nonce-based**: Implementasi Content Security Policy berbasis Nonce di `middleware.ts` (mencegah XSS).
- **HSTS Header**: Strict-Transport-Security diaktifkan.
- **Service Role Isolation**: `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di API server-side untuk Bypass RLS pada fungsi sensitif (seperti webhook payment). Tidak pernah di-expose ke client.
- **Rate Limiting**: Rate limiter bawaan (`lib/rate-limit.ts`) membatasi jumlah request per IP/User.
- **Security Audit Logger**: Setiap event sensitif dicatat ke `admin_activity_logs` (`lib/security-logger.ts`).
- **Atomic Transaction**: Mencegah race condition pada transaksi wallet dan pergerakan dadu game melalui PostgreSQL Stored Procedures (`SELECT FOR UPDATE`).

---

## 5. Sistem Couple Linking

Proses penghubungan dua akun dilakukan secara **atomic** menggunakan Stored Procedure `link_couple`:

```
[User A] -> Copy Couple Code (10 Karakter) -> Kirim ke User B
[User B] -> Input Code di /dashboard/couple -> Submit
         -> POST /api/couple/link
         -> RPC link_couple(user_b_id, couple_code_a)
         -> Stored Procedure executing:
            1. Lock baris users User A & User B
            2. Update User A: partner_id = User B, status = 'linked'
            3. Update User B: partner_id = User A, status = 'linked'
         -> Response Success -> Both users status = 'linked'
```

 Fungsionalitas Unlink (`unlink_couple`) juga berjalan secara atomic dengan mereset `partner_id` ke `NULL` dan `status` ke `'single'` untuk kedua belah pihak.

---

## 6. Sistem Pembayaran & Top-Up Coin (Midtrans)

```
[User] -> Pilih Paket Coin di /dashboard/coin
       -> POST /api/coin/topup
       -> Server: Buat transaction row (status: 'pending', reference: 'LDR-xxx')
       -> Server: Request Snap Token ke Midtrans Snap API
       -> Client: Buka Popup Midtrans Snap via Client Key
       -> User menyelesaikan pembayaran (QRIS/Bank/GoPay)
       -> Midtrans Webhook -> POST /api/coin/webhook
          1. Verifikasi Signature Hash (SHA512)
          2. Panggil Stored Procedure update_payment_status
          3. Set transaction status = 'paid'
          4. Atomic increment balance pada wallets User
       -> Client: Click "Saya Sudah Bayar" -> GET /api/coin/verify -> Refresh Balance
```

---

## 7. Sistem Game & Session Lifecycle

### Lifecycle Sesi Game

```
   +------------------+
   |     CREATED      | (Host deduct coin, status: 'waiting', set expires_at)
   +--------+---------+
            |
    +-------+-------+
    |               |
    v               v
+-------+       +-----------+
| JOINED|       | EXPIRED / | (Tidak ada partner dalam X menit ->
+---+---+       | CANCELLED |  Stored Proc refund coin ke Host)
    |           +-----------+
    v
+-------+
|PLAYING| (Realtime syncing via Supabase Realtime)
+---+---+
    |
    v
+-----------+
| COMPLETED | (Game usai, hasil akhir disimpan)
+-----------+
```

---

## 8. Detail Gameplay per Game Mode

### 8.1 Truth or Dare (ToD)
- **Biaya**: 1 Coin
- **Waktu Tunggu (Expiry)**: 10 Menit
- **Mekanisme**:
  1. Host membuat sesi, `questions` JSONB diisi array mix antara Truth & Dare dari database (`game_tod_questions`) atau AI (Gemini).
  2. Pemain bergantian memilih giliran.
  3. Pemain aktif menjawab / menjalankan tantangan, lalu mengirim status selesai (`POST /api/game/tod/session/{code}/done`).
  4. Sesi selesai saat seluruh pertanyaan habis terimbawa.

### 8.2 Snake & Ladder (Ular Tangga)
- **Biaya**: 5 Coin
- **Waktu Tunggu (Expiry)**: 20 Menit
- **Mekanisme**:
  1. `board_config` mengarahkan posisi Ular, Tangga, dan Kotak Tantangan.
  2. Player melempar dadu (`POST /api/game/snake/session/{code}/roll`).
  3. Stored Procedure `roll_snake_dice` mengeksekusi perhitungan posisi secara atomic dengan `SELECT FOR UPDATE`.
  4. Jika mendarat di Kotak Tantangan, `pending_challenge` di-set pada `game_state`. Player wajib menyelesaikan tantangan dan mengonfirmasinya (`POST /api/game/snake/session/{code}/confirm`).
  5. Player pertama yang mencapai kotak 100 dinyatakan sebagai Pemenang (`winner`).

### 8.3 Dare Derby
- **Biaya**: 5 Coin
- **Mekanisme**:
  1. Terdiri dari beberapa ronde mini-game (menggunakan **Phaser 4**).
  2. Jenis mini-game: `Tap Timing`, `Memory Sequence`, `Number Order`, `Color Match`, `Reaction Button`, `True/False`, `Word Scramble`.
  3. Kedua pemain bertanding bersamaan dan mengirimkan skor (`POST /api/game/dare-derby/session/{code}/submit`).
  4. Pemain dengan skor lebih rendah pada ronde tersebut kalah dan mendapatkan **Dare** sesuai tingkat keparahan (`sweet_only`, `mixed`, `full_chaos`).
  5. Setelah mengonfirmasi Dare (`POST /api/game/dare-derby/session/{code}/dare`), game berlanjut ke ronde berikutnya hingga usai.

---

## 9. Integration Engine: Realtime & Video Call

### Supabase Realtime Architecture
Client terhubung ke channel WebSocket game untuk menerima update state tanpa polling:

```typescript
const channel = supabase
  .channel(`game-session-${sessionCode}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'game_sessions',
    filter: `session_code=eq.${sessionCode}`,
  }, (payload) => {
    const updatedSession = payload.new;
    // Update local state React / Zustand
  })
  .subscribe();

// Mandatory cleanup pada unmount
return () => { supabase.removeChannel(channel); };
```

### Daily.co In-App Video Call
1. Saat game room dimuat, client merequest endpoint room (`POST /api/game/{type}/session/{code}/room`).
2. Server membuat / mengambil URL Daily.co room via API key.
3. Komponen `<VideoCall roomUrl={url} />` memuat SDK `@daily-co/daily-js` dan menampilkan overlay video call interaktif di atas papan game.

---

## 10. Daftar Stored Procedures PostgreSQL

| Stored Procedure | File Migration | Peran & Deskripsi |
|---|---|---|
| `link_couple(p_user_id, p_code)` | `003_functions.sql` | Menautkan dua user secara atomic |
| `unlink_couple(p_user_id)` | `003_functions.sql` | Memutuskan tautan dua user |
| `create_game_session(...)` | `003_functions.sql` | Memotong coin host & membuat game session baru |
| `join_game_session(...)` | `003_functions.sql` | Memverifikasi & memasukkan partner ke game session |
| `update_payment_status(...)` | `003_functions.sql` | Mengubah status transaksi Midtrans & menambah saldo coin |
| `roll_snake_dice(...)` | `008_atomic_snake_and_cancel.sql` | Menghitung pergerakan dadu & board event ular tangga (Atomic) |
| `confirm_snake_challenge(...)` | `008_atomic_snake_and_cancel.sql` | Mengonfirmasi penyelesaian tantangan ular tangga |
| `cancel_game_session(...)` | `008_atomic_snake_and_cancel.sql` | Membatalkan sesi & mengembalikan coin host |
| `expire_waiting_sessions()` | `011_enforce_session_expiry.sql` | Cron job handler untuk kadaluwarsa sesi otomatis |

---

## 11. Environment Variables Reference

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...    # Client-side safe
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...        # SERVER ONLY - DO NOT EXPOSE

# Application Domain
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Payment Gateway (Midtrans)
MIDTRANS_SERVER_KEY=SB-Mid-server-...      # SERVER ONLY
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_IS_PRODUCTION=false

# AI Generation
GEMINI_API_KEY=AIzaSy...                  # SERVER ONLY
OPENROUTER_API_KEY=sk-or-v1-...           # SERVER ONLY

# Daily.co Video Call
DAILY_API_KEY=0123456789abcdef...          # SERVER ONLY
NEXT_PUBLIC_DAILY_DOMAIN=yourdomain.daily.co
```
