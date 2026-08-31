# Security Fixes — Ringkasan 12 Issue

Dokumen ini merangkum semua perbaikan keamanan yang telah dilakukan pada project **LDR-Connect** berdasarkan audit OWASP Secure Coding Practices.

Audit dilakukan pada: **2026-04-27**

---

## ✅ 10 Issue yang Sudah Diperbaiki

---

### RC-01 — Snake Game: Race Condition pada Roll & Confirm

**Problem:** Logika `roll dice` dan `confirm challenge` di TypeScript menggunakan pola baca-hitung-tulis tanpa row locking. Dua request simultan bisa membuat game state korup (kedua pemain dianggap giliran, posisi pion tidak konsisten).

**Fix:**
- Dibuat stored procedure `roll_snake_dice` dan `confirm_snake_challenge` di PostgreSQL (migration `008_atomic_snake_and_cancel.sql`) dengan `SELECT ... FOR UPDATE`.
- Seluruh transisi state game terjadi atomik di dalam satu database transaction.
- `app/api/game/snake/session/[code]/roll/route.ts` dan `confirm/route.ts` diubah menjadi thin wrapper yang hanya memanggil RPC.

**Files:**
- `supabase/migrations/008_atomic_snake_and_cancel.sql` (baru)
- `app/api/game/snake/session/[code]/roll/route.ts` (ditulis ulang)
- `app/api/game/snake/session/[code]/confirm/route.ts` (ditulis ulang)

---

### RC-02 — Cancel Session: Double Refund Race Condition

**Problem:** `cancel/route.ts` melakukan cek `coin_refunded_at IS NULL` lalu refund sebagai operasi terpisah. Dua request cancel simultan bisa lolos cek, menghasilkan dua kali refund.

**Fix:**
- Dibuat stored procedure `cancel_game_session` (migration 008) yang mengunci baris session dengan `SELECT ... FOR UPDATE` sebelum mengecek dan memproses refund. Semua dalam satu transaction.
- `app/api/game/tod/session/[code]/cancel/route.ts` diubah menjadi thin wrapper ke RPC.

**Files:**
- `supabase/migrations/008_atomic_snake_and_cancel.sql` (baru)
- `app/api/game/tod/session/[code]/cancel/route.ts` (ditulis ulang)

---

### PAY-01 — Verify: Tidak Cek `fraud_status`

**Problem:** `verify/route.ts` menganggap transaksi `capture` sebagai "paid" tanpa mengecek `fraud_status === "accept"`. Transaksi `capture` dengan `fraud_status === "challenge"` seharusnya tidak dianggap lunas.

**Fix:** Ditambahkan pengecekan `fraudStatus === "accept"` untuk transaksi `capture`, konsisten dengan logika di `webhook/route.ts`.

**File:** `app/api/coin/verify/route.ts`

---

### PAY-02 — Verify: Tidak Validasi Kepemilikan

**Problem:** Siapapun yang tahu `payment_reference` orang lain bisa memanggil `/api/coin/verify` dan mendapatkan status transaksi milik user lain.

**Fix:** Ditambahkan ownership check — query `coin_transactions.user_id` dan bandingkan dengan `auth.uid()` sebelum memanggil RPC update.

**File:** `app/api/coin/verify/route.ts`

---

### PAY-03 — Webhook: Log Payload Sensitif

**Problem:** `webhook/route.ts` meng-log seluruh payload Midtrans (`JSON.stringify(body)`) termasuk field sensitif seperti `gross_amount`, `masked_card`, `va_numbers`.

**Fix:** Hanya tiga field non-sensitif yang di-log: `order_id`, `transaction_status`, `fraud_status`.

**File:** `app/api/coin/webhook/route.ts`

---

### PAY-04 — Topup: `Math.random()` untuk Order ID

**Problem:** Order ID Midtrans dibuat dengan `Math.random().toString(36)` — bukan CSPRNG. Nilai ini bisa diprediksi jika attacker tahu timing-nya.

**Fix:** Diubah ke `crypto.randomBytes(4).toString("hex")` — cryptographically secure random.

**File:** `app/api/coin/topup/route.ts`

---

### PAY-05 — Tidak Ada `Cache-Control` untuk Halaman Payment

**Problem:** Response dari endpoint payment (`/api/coin/*`, `/topup/*`) bisa di-cache oleh browser atau proxy, mengekspos data transaksi ke session berikutnya.

**Fix:** Ditambahkan header `Cache-Control: no-store, no-cache, must-revalidate` dan `Pragma: no-cache` untuk semua route `/api/coin/*` dan `/topup/*`.

**File:** `next.config.ts`

---

### SEC-02 — Tidak Ada HSTS Header

**Problem:** Tidak ada `Strict-Transport-Security` header, sehingga browser tidak memaksa HTTPS pada kunjungan berikutnya (rentan SSL stripping).

**Fix:** Ditambahkan `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` ke semua response.

**File:** `next.config.ts`

---

### DEP-01 — Fungsi Database Deprecated Masih Ada

**Problem:** Tiga fungsi SQL lama (`create_snake_session`, `join_snake_session`, `get_active_snake_session_for_couple`) mereferensikan tabel `game_snake_sessions` yang sudah dihapus di migration 006. Tidak ada kode yang memanggilnya tapi tetap menjadi attack surface.

**Fix:** Dibuat migration 009 yang men-drop ketiga fungsi tersebut.

**File:** `supabase/migrations/009_drop_deprecated_snake_functions.sql` (baru)

---

### DEP-02 — `.env.local.example` Menggunakan Variabel Lama

**Problem:** File `.env.local.example` masih berisi variabel dari stack lama (Laravel + Laravel Reverb) yang tidak relevan. Developer baru bisa setup environment yang salah.

**Fix:** File diperbarui dengan variabel yang benar untuk stack saat ini: Supabase, Midtrans, Daily.co, Gemini, dan OpenRouter.

**File:** `.env.local.example`

---

## 🔴 2 Issue yang Diperbaiki Setelah Ini

---

### SEC-01 — CSP Menggunakan `unsafe-inline` dan `unsafe-eval`

**Problem:** `script-src 'unsafe-inline'` secara efektif menonaktifkan perlindungan XSS dari Content Security Policy — injeksi script inline langsung berjalan.

**Fix (issue #11):** Implementasi nonce-based CSP via `middleware.ts`. Setiap request mendapatkan nonce unik; CSP `script-src` menggunakan `'nonce-{value}'` + `'strict-dynamic'` sebagai pengganti `'unsafe-inline'`.

---

### LOG-01 — Tidak Ada Security Event Logging

**Problem:** Tidak ada logging untuk percobaan autentikasi gagal, 401/403 responses, webhook signature mismatch, atau payment ownership violations.

**Fix (issue #12):** Dibuat `lib/security-logger.ts` helper yang menulis ke tabel `admin_activity_logs`. Diintegrasikan ke `webhook/route.ts` (log signature fail) dan `verify/route.ts` (log ownership violation).

---

## 📊 Status Akhir

| ID | Deskripsi | Status |
|----|-----------|--------|
| RC-01 | Snake game state atomic | ✅ DONE |
| RC-02 | Cancel refund atomic | ✅ DONE |
| PAY-01 | `verify` cek `fraud_status` | ✅ DONE |
| PAY-02 | `verify` cek kepemilikan | ✅ DONE |
| PAY-03 | Webhook non-sensitive log | ✅ DONE |
| PAY-04 | `crypto.randomBytes()` untuk order ID | ✅ DONE |
| PAY-05 | `Cache-Control: no-store` untuk payment | ✅ DONE |
| SEC-01 | CSP nonce-based (ganti `unsafe-inline`) | ✅ DONE |
| SEC-02 | HSTS header | ✅ DONE |
| LOG-01 | Security event logging | ✅ DONE |
| DEP-01 | Drop fungsi deprecated | ✅ DONE |
| DEP-02 | `.env.local.example` diperbarui | ✅ DONE |

---

> Sisa item `[(x)]` di `SECURITY_CHECKLIST.md` (brute force, MFA, session timeout, dll.) memerlukan keputusan arsitektur atau konfigurasi Supabase — bukan perubahan kode aplikasi.
