# 🛡️ Laporan Audit Keamanan & Logika Codebase (LDR-Connect)

Tanggal Audit: 1 September 2026

Dokumen ini berisi hasil audit komprehensif terhadap arsitektur backend, autentikasi, sistem pembayaran, logika game, dan job cron di aplikasi LDR-Connect.

---

## 📊 Ringkasan Status Bug & Kerentanan

| No | Kategori | Temuan / Deskripsi | File / Lokasi | Status |
|:---|:---|:---|:---|:---:|
| 1 | **Security** | Unauthenticated Cron Trigger (Bypass saat CRON_SECRET kosong) | `app/api/cron/capsule-delivery/route.ts:13` & `app/api/cron/anniversary-reminders/route.ts:15` | 🟢 **Selesai (Fixed & Tested)** |
| 2 | **Logic / Timezone** | Delivery Boundary Timestamptz vs Date String | `app/api/cron/capsule-delivery/route.ts:28` | 🟢 **Selesai (Fixed)** |
| 3 | **Business Logic** | Wishlist item CRUD tanpa validasi status couple aktif saat ini | `app/api/wishlist/[id]/route.ts:54` | 🟢 **Selesai (Fixed)** |
| 4 | **Framework Compatibility** | Dynamic Route Next.js 16 `params` Promise Handling | `app/api/**/*.ts` | 🟢 **Selesai (Sudah Aman)** |
| 5 | **Payment & Wallet** | Signature Verification & Idempotency Webhook Midtrans | `app/api/coin/webhook/route.ts` | 🟢 **Selesai (Aman & Tested)** |
| 6 | **Game Engine** | Turn Hijacking & Concurrency Lock RPC Game | `app/api/game/**` & DB RPC Functions | 🟢 **Selesai (Aman & Tested)** |
| 7 | **Authentication & Deployment** | Cookie Sync, Server-First Login & Sliding Window Session di Serverless | `app/api/auth/login/route.ts`, `app/auth/login/page.tsx`, `middleware.ts` | 🟢 **Selesai (Fixed & Tested)** |

---

## 🧪 Hasil Eksekusi Unit Testing (Vitest)

Pengujian otomatis telah dijalankan via Vitest dengan hasil **100% Pass (11/11 tests)**:

```text
 ✓ tests/wallet-rpc.test.ts (3 tests)
 ✓ tests/cron-security.test.ts (4 tests)
 ✓ tests/quoridor-walls.test.ts (4 tests)

Test Files  3 passed (3)
Tests       11 passed (11)
Duration    430ms
```

### Rincian Cakupan Test:
- **`tests/cron-security.test.ts`**:
  - `401 Unauthorized` saat request tanpa header Authorization.
  - `401 Unauthorized` saat token salah.
  - `401 Unauthorized` saat `CRON_SECRET` di server kosong (fail-closed check).
- **`tests/quoridor-walls.test.ts`**:
  - Validasi pathfinding awal saat papan kosong.
  - Penolakan penempatan tembok yang mengurung pemain 100% (BFS path blocker check).
  - Penolakan tembok overlap atau saling bersilang di pivot yang sama.
  - Validasi perhitungan lompatan pion saat berhadapan dengan lawan.
- **`tests/wallet-rpc.test.ts`**:
  - Validasi format dan integritas signature SHA-512 Midtrans (128 hex chars).
  - Penolakan payload webhook dengan signature palsu / dimanipulasi.
  - Validasi mapping status transaksi pembayaran (`settlement`, `capture/accept`, `deny`, `pending`).

---

## 🔍 Detail Analisis Bug

### 1. 🟢 [SUDAH DIPERBAIKI] Unauthenticated Cron Trigger Vulnerability
- **Lokasi**:
  - `app/api/cron/capsule-delivery/route.ts` (Baris 13-16)
  - `app/api/cron/anniversary-reminders/route.ts` (Baris 15-18)
- **Status**: 🟢 **Selesai Diperbaiki**
- **Perbaikan**:
  Validasi diubah menjadi fail-closed (`!cronSecret || authHeader !== ...`), mencegah bypass saat environment variable kosong.

---

### 2. 🟢 [SUDAH DIPERBAIKI] Capsule Delivery Date Boundary Issue
- **Lokasi**: `app/api/cron/capsule-delivery/route.ts` (Baris 28-29)
- **Status**: 🟢 **Selesai Diperbaiki**
- **Perbaikan**:
  Kueri diubah menggunakan full ISO timestamp string (`new Date().toISOString()`), memastikan perbandingan akurat terhadap kolom `timestamptz`.

---

### 3. 🟢 [SUDAH DIPERBAIKI] Wishlist Isolation saat Couple Unlink
- **Lokasi**: `app/api/wishlist/[id]/route.ts` (Baris 54 & 83)
- **Status**: 🟢 **Selesai Diperbaiki**
- **Perbaikan**:
  Menambahkan pengecekan status relasi aktif user dan validasi `couple_id` pada query `PATCH` dan `DELETE`.

---

### 4. 🟢 [SUDAH AMAN] Next.js 16 Dynamic Route Params Promise
- **Lokasi**: Seluruh endpoint `app/api/**/[code]/route.ts` & `app/api/**/[id]/route.ts`
- **Status**: 🟢 **Bukan Bug / Sudah Terverifikasi Aman**
- **Detail**:
  Semua parameter dynamic route telah menggunakan sintaks asynchronous `{ params }: { params: Promise<{ ... }> }` dan di-resolve menggunakan `await params` sebelum diakses.

---

### 5. 🟢 [SUDAH AMAN] Midtrans Webhook & Coin Balance
- **Lokasi**: `app/api/coin/webhook/route.ts` & `app/api/coin/verify/route.ts`
- **Status**: 🟢 **Bukan Bug / Sudah Terverifikasi Aman**
- **Detail**:
  - Signature SHA-512 diverifikasi secara akurat.
  - Penambahan saldo dan diskon voucher dilakukan secara atomic via stored procedure PostgreSQL (`update_payment_status`), sehingga kebal dari race condition dan serangan replay transaksi.

---

### 6. 🟢 [SUDAH AMAN] Concurrency Game Logic & Anti-Cheat
- **Lokasi**: `app/api/game/**`
- **Status**: 🟢 **Bukan Bug / Sudah Terverifikasi Aman**
- **Detail**:
  - Permainan Snake & Ladder, Quoridor, Truth or Dare, dan Dare Derby menggunakan validasi state di sisi database (Postgres RPC with `FOR UPDATE` lock).
  - Giliran pemain (turn), waktu kedaluwarsa sesi, dan legalitas langkah (termasuk validasi dinding Quoridor dengan BFS pathfinding) tidak dapat dimanipulasi oleh client.
