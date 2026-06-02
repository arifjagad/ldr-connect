# LDR-Connect — Fresh Database Setup

Folder ini berisi schema **konsolidasi** yang merepresentasikan state akhir database setelah semua migrasi diterapkan. Gunakan folder ini untuk setup database baru dari nol.

## Urutan Eksekusi

Jalankan file-file berikut **secara berurutan** di Supabase SQL Editor:

| Urutan | File | Isi |
|--------|------|-----|
| 1 | `01_tables.sql` | Semua tabel, index, trigger auto-update, trigger signup |
| 2 | `02_rls.sql` | Row Level Security + helper functions (`get_my_partner_id`, `is_admin`) |
| 3 | `03_functions.sql` | Semua RPC functions (state akhir, tanpa yang deprecated) |
| 4 | `04_seed_data.sql` | `game_settings`, `coin_packages`, `game_minigame_configs`, `game_dare_questions`, `vouchers` (dummy) |
| 5 | `05_seed_tod_questions.sql` | ~70 pertanyaan Truth or Dare |
| 6 | `06_seed_snake_questions.sql` | 100 pertanyaan Ular Tangga |

## Yang Sudah Digabungkan dari Migrations

| Migration(s) | Isi | Status di schema/ |
|---|---|---|
| 001 | Tables + triggers + seed settings | ✅ `01_tables.sql` |
| 002 | RLS policies | ✅ `02_rls.sql` |
| 003 | Functions (termasuk deprecated) | ✅ `03_functions.sql` (hanya yang aktif) |
| 004 | Seed ToD questions | ✅ `05_seed_tod_questions.sql` |
| 005 | Seed Snake questions | ✅ `06_seed_snake_questions.sql` |
| 006 | Tambah `board_config`+`game_state` ke `game_sessions`, hapus `game_snake_sessions` | ✅ `01_tables.sql` |
| 007 | Drop versi lama `create_game_session` (6-param) | ✅ Tidak ada di `03_functions.sql` |
| 008 | `roll_snake_dice`, `confirm_snake_challenge`, `cancel_game_session` (atomic) | ✅ `03_functions.sql` |
| 009 | Drop fungsi snake deprecated | ✅ Tidak ada di `03_functions.sql` |
| 010 | Tabel `rate_limit_events` + RPC `check_and_record_rate_limit` | ✅ `01_tables.sql` + `03_functions.sql` |
| 011 | `roll_snake_dice` + `confirm_snake_challenge` → tambah cek expires_at | ✅ `03_functions.sql` |
| 012 | `create_game_session` → auto-expire + cek `expires_at > NOW()` | ✅ `03_functions.sql` |
| 013 | `get_active_session_for_couple` → param `p_game_type` + filter expires_at | ✅ `03_functions.sql` |
| 014 | Tabel `game_dare_questions` + `game_minigame_configs` + RLS; `dare_derby` di game_type constraint | ✅ `01_tables.sql` + `02_rls.sql` |
| 015 | Dare Derby functions (submit, confirm, skip, ready_up, complete) | ✅ `03_functions.sql` |
| 016 | Seed dare questions + minigame configs + game_settings dare_derby | ✅ `04_seed_data.sql` |
| 017 | Fix `select_dare_derby_minigames` (CROSS JOIN LATERAL) | ✅ `03_functions.sql` (versi terbaru) |
| 018 | Fix `confirm_dare_derby_dare` → masuk lobby dulu | ✅ `03_functions.sql` (versi terbaru) |
| 019 | Tambah mini-game `number_order` | ✅ `04_seed_data.sql` |
| 020 (anniversaries) | RLS SELECT anniversaries dibuka ke partner | ✅ `02_rls.sql` (`anniversaries_select_couple`) |
| 021 (anniversaries) | RLS UPDATE anniversaries dibuka ke partner | ✅ `02_rls.sql` (`anniversaries_update_couple`) |
| 020 (vouchers) | Tabel `vouchers` + `voucher_redemptions` + RLS + `redeem_voucher` | ✅ `01_tables.sql` + `02_rls.sql` + `03_functions.sql` |
| 020b (vouchers seed) | Dummy vouchers untuk testing | ✅ `04_seed_data.sql` |
| 021 (vouchers) | Tipe diskon, fix `coin_value` nullable, + `apply_topup_discount`, `redeem_voucher` update | ✅ `01_tables.sql` + `03_functions.sql` |
| 022 | Tabel `wishlists` + RLS + Realtime | ✅ `01_tables.sql` + `02_rls.sql` |
| 023 | Tabel `capsules` + RLS + Realtime | ✅ `01_tables.sql` + `02_rls.sql` |
| 024 | `quoridor` di game_type constraint + seed game_settings + `quoridor_action` v1 | ✅ `01_tables.sql` + `04_seed_data.sql` + `03_functions.sql` |
| 025 | `quoridor_action` v2 — jump logic (lurus + diagonal) + wall overlap check | ✅ `03_functions.sql` (versi terbaru) |
| 026 | `quoridor_has_path` (BFS) + `quoridor_action` v3 — BFS validation | ✅ `03_functions.sql` (versi terbaru) |
| 027 | `quoridor_action` v4 — fix deteksi lompatan lurus (delta-based) | ✅ `03_functions.sql` (versi terbaru, state akhir) |
| `add_avatar_url` | Kolom `avatar_url TEXT` pada tabel `users` | ✅ `01_tables.sql` |
| `push_subscriptions` | Tabel `push_subscriptions` + RLS | ✅ `01_tables.sql` + `02_rls.sql` |

## Fungsi yang Dihapus (Deprecated)

| Fungsi | Alasan Dihapus |
|--------|----------------|
| `create_snake_session` | Digantikan `create_game_session` (migration 006) |
| `join_snake_session` | Digantikan `join_game_session` (migration 006) |
| `get_active_snake_session_for_couple` | Digantikan `get_active_session_for_couple` (migration 006) |
| `create_game_session` (6-param) | Digantikan versi 8-param (migration 007) |
| `validate_topup_voucher` | Digantikan oleh `/api/coin/check-voucher` endpoint (lebih fleksibel) |

## Folder `migrations/` — Untuk Apa?

Folder `migrations/` tetap ada sebagai **rekam jejak historis**. Jangan dijalankan ulang jika database sudah ada — hanya untuk referensi dan audit trail perubahan schema dari waktu ke waktu.

## Ringkasan Tabel Aktif

| Tabel | Keterangan |
|-------|------------|
| `users` | Profil user + couple_code + avatar_url |
| `wallets` | Saldo coin per user |
| `coin_packages` | Paket topup coin |
| `coin_transactions` | Riwayat topup & deduct coin |
| `game_sessions` | Sesi semua game (tod, snake_ladder, dare_derby, quoridor) |
| `game_tod_questions` | Pertanyaan Truth or Dare |
| `game_snake_questions` | Pertanyaan tantangan Ular Tangga |
| `game_dare_questions` | Pool dare untuk Dare Derby |
| `game_minigame_configs` | Konfigurasi mini-game Dare Derby |
| `game_settings` | Konfigurasi biaya & durasi per game type |
| `rate_limit_events` | Event rate limiting berbasis DB |
| `anniversaries` | Pengingat anniversary pasangan |
| `wishlists` | Bucket list bersama pasangan |
| `capsules` | Kapsul waktu digital (pesan terkunci) |
| `vouchers` | Voucher coin gratis & diskon topup |
| `voucher_redemptions` | Log penggunaan voucher per user |
| `push_subscriptions` | Web Push subscription untuk notifikasi |
| `admin_activity_logs` | Log aktivitas admin |
