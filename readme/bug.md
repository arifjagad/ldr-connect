# 🐛 LDR-Connect Bug Report & Audit List

Dokumen ini mencatat daftar bug dan isu teknis yang ditemukan pada codebase LDR-Connect serta status perbaikannya.

---

## 🚨 1. Critical Severity Bugs (Harus Segera Diperbaiki)

### BUG-01: Mismatch Env Key Supabase Client (`PUBLISHABLE_KEY` vs `ANON_KEY`) [FIXED ✅]
- **Lokasi**: [lib/supabase/server.ts:20](lib/supabase/server.ts#L20), [lib/supabase/client.ts:13](lib/supabase/client.ts#L13)
- **Kategori**: Configuration / Authentication Failure
- **Deskripsi**:
  File `lib/supabase/server.ts` dan `lib/supabase/client.ts` membaca `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!`. Padahal file sampel `.env.local.example`, `CLAUDE.md`, dan standar Supabase menggunakan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Dampak**:
  Jika `.env.local` hanya berisi `NEXT_PUBLIC_SUPABASE_ANON_KEY`, koneksi Supabase di client & server akan `undefined` dan menyebabkan kegagalan autentikasi di seluruh aplikasi.
- **Status Fix**:
  Telah diperbaiki dengan mengganti key menjadi `NEXT_PUBLIC_SUPABASE_ANON_KEY!`.

---

## 🔴 2. High Severity Bugs

### BUG-02: Orphaned Daily.co Room pada Kegagalan `create_game_session` [FIXED ✅]
- **Lokasi**:
  - [app/api/game/tod/session/create/route.ts:122-124](app/api/game/tod/session/create/route.ts#L122-L124)
  - [app/api/game/snake-ladder/session/create/route.ts:161](app/api/game/snake-ladder/session/create/route.ts#L161)
  - [app/api/game/dare-derby/session/create/route.ts:124](app/api/game/dare-derby/session/create/route.ts#L124)
- **Kategori**: Third-Party Integration / Resource Leak
- **Deskripsi**:
  API route memanggil `await createDailyRoom(sessionCode, ...)` **sebelum** memanggil Stored Procedure `create_game_session` di database. Jika `create_game_session` gagal (misalnya karena `INSUFFICIENT_COINS` atau `ACTIVE_SESSION`), room Daily.co sudah terlanjur dibuat di cloud Daily.co dan ditinggalkan (orphaned).
- **Dampak**:
  Pemborosan kuota API Daily.co & resource leak room yang tidak terpakai.
- **Status Fix**:
  Telah diperbaiki dengan memindahkan pemanggilan `createDailyRoom` setelah Stored Procedure `create_game_session` dipastikan sukses.

### BUG-03: UTC vs WIB Discrepancy pada Cron Capsule Delivery [FIXED ✅]
- **Lokasi**: [app/api/cron/capsule-delivery/route.ts:19](app/api/cron/capsule-delivery/route.ts#L19)
- **Kategori**: Business Logic / Timezone Handling
- **Deskripsi**:
  Di `app/api/capsule/route.ts`, penentuan tanggal hari ini menggunakan WIB (`UTC+7`). Namun di cron job `app/api/cron/capsule-delivery/route.ts`, variabel `today` dihitung menggunakan `new Date().toISOString().split("T")[0]` (UTC murni).
- **Dampak**:
  Jika cron berjalan jam 07:00 WIB (00:00 UTC), kapsul yang diset buka pada hari itu di WIB berisiko tidak terkirim via cron tepat waktu jika ada selisih konversi tanggal UTC/WIB.
- **Status Fix**:
  Telah diperbaiki dengan menyelaraskan kalkulasi `today` menggunakan offset WIB (`UTC+7`).

---

## 🟡 3. Medium Severity Bugs

### BUG-04: Timestamp Mutation Bug pada Capsule Lazy Delivery [FIXED ✅]
- **Lokasi**: [app/api/capsule/route.ts:37](app/api/capsule/route.ts#L37)
- **Kategori**: Data Integrity
- **Deskripsi**:
  Saat lazy delivery dijalankan di `GET /api/capsule`, `delivered_at` diisi dengan `new Date().toISOString()`. Namun sebelumnya variabel `nowWib` dibentuk dengan menggeser timestamp `+ 7 jam`. Jika `nowWib` dipakai untuk membentuk Date baru, timestamp yang tersimpan bisa tergeser 7 jam lebih cepat dari UTC sebenarnya.
- **Dampak**:
  Nilai `delivered_at` di database tidak menunjukkan waktu UTC yang tepat.
- **Status Fix**:
  Telah dipastikan `delivered_at` menggunakan `new Date().toISOString()` UTC murni secara terpisah dari kalkulasi tanggal WIB `todayWib`.

### BUG-05: Silent Catch Failure pada Midtrans Snap API Request [FIXED ✅]
- **Lokasi**: [app/api/coin/topup/route.ts:234-236](app/api/coin/topup/route.ts#L234-L236)
- **Kategori**: Error Handling / UX
- **Deskripsi**:
  Saat `fetch(MIDTRANS_API_URL)` mengalami error koneksi/network, blok `catch` hanya berisi komentar tanpa melempar error atau memberikan flag error ke client. Client tetap menerima `success: true` tetapi `snap_token` dan `payment_url` bernilai `null`.
- **Dampak**:
  User tidak diberi tahu bahwa jaringan ke Midtrans gagal, UI popup pembayaran tidak muncul.
- **Status Fix**:
  Telah diperbaiki dengan memberikan logging error terperinci dan mengembalikan response error HTTP 500/502 jika dipanggil gagal.

---

## 🟢 4. Low Severity / Edge Cases

### BUG-06: Partial Answer Score Loss pada MemorySequenceGame Timeout [FIXED ✅]
- **Lokasi**: [components/games/dare-derby/mini-games/MemorySequenceGame.tsx:80-85](components/games/dare-derby/mini-games/MemorySequenceGame.tsx#L80-L85)
- **Kategori**: Gameplay Edge Case
- **Deskripsi**:
  Jika waktu habis di `MemorySequenceGame` sebelum 5 warna selesai diinput, `finish()` dipanggil dengan `correctCountRef.current`. Namun jika timer habis tepat di tengah transition state `showing` ke `input`, skor bisa bernilai 0 tanpa menghitung partial input.
- **Dampak**:
  Minor UI score display inconsistency saat timeout mendadak.
- **Status Fix**:
  Telah diperbaiki dengan memastikan `correctCountRef.current` di-reset ke `0` saat fasa `showing` dimulai.
