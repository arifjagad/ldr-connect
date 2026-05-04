# LDR-Connect — Fresh Database Setup

Folder ini berisi schema **konsolidasi** yang merepresentasikan state akhir database setelah semua migrasi diterapkan. Gunakan folder ini untuk setup database baru dari nol.

## Urutan Eksekusi

Jalankan file-file berikut **secara berurutan** di Supabase SQL Editor:

| Urutan | File | Isi |
|--------|------|-----|
| 1 | `01_tables.sql` | Semua tabel, index, trigger auto-update, trigger signup |
| 2 | `02_rls.sql` | Row Level Security + helper functions (`get_my_partner_id`, `is_admin`) |
| 3 | `03_functions.sql` | Semua RPC functions (state akhir, tanpa yang deprecated) |
| 4 | `04_seed_data.sql` | `game_settings` + `coin_packages` |
| 5 | `05_seed_tod_questions.sql` | ~70 pertanyaan Truth or Dare |
| 6 | `06_seed_snake_questions.sql` | 100 pertanyaan Ular Tangga |

## Yang Sudah Digabungkan dari Migrations

| Migration | Isi | Status di schema/ |
|-----------|-----|-------------------|
| 001 | Tables + triggers + seed settings | ✅ Di `01_tables.sql` (dengan update dari 006) |
| 002 | RLS policies | ✅ Di `02_rls.sql` |
| 003 | Functions (termasuk deprecated) | ✅ Di `03_functions.sql` (hanya yang aktif) |
| 004 | Seed ToD questions | ✅ Di `05_seed_tod_questions.sql` |
| 005 | Seed Snake questions | ✅ Di `06_seed_snake_questions.sql` |
| 006 | Tambah `board_config`+`game_state` ke `game_sessions`, hapus `game_snake_sessions` | ✅ Sudah masuk `01_tables.sql` |
| 007 | Drop versi lama `create_game_session` (6-param) | ✅ Tidak ada di `03_functions.sql` |
| 008 | `roll_snake_dice`, `confirm_snake_challenge`, `cancel_game_session` (atomic) | ✅ Di `03_functions.sql` |
| 009 | Drop fungsi snake deprecated | ✅ Tidak ada di `03_functions.sql` |
| 010 | Tabel `rate_limit_events` + RPC `check_and_record_rate_limit` | ✅ Di `01_tables.sql` + `03_functions.sql` |
| 011 | Update `roll_snake_dice` + `confirm_snake_challenge` dengan cek expiry | ✅ Sudah masuk `03_functions.sql` |
| 012 | Fix `create_game_session`: auto-expire sesi kedaluwarsa + cek `expires_at > NOW()` | ✅ Sudah masuk `03_functions.sql` |
| 013 | Fix `get_active_session_for_couple`: tambah param `p_game_type` + cek `expires_at > NOW()` | ✅ Sudah masuk `03_functions.sql` |

## Folder `migrations/` — Untuk Apa?

Folder `migrations/` tetap ada sebagai **rekam jejak historis**. Jangan dijalankan ulang jika database sudah ada — hanya untuk referensi dan audit trail perubahan.

## Fungsi yang Dihapus (Deprecated)

Fungsi-fungsi berikut **tidak ada** di schema fresh ini karena sudah dihapus:

| Fungsi | Alasan Dihapus |
|--------|----------------|
| `create_snake_session` | Digantikan `create_game_session` (migration 006) |
| `join_snake_session` | Digantikan `join_game_session` (migration 006) |
| `get_active_snake_session_for_couple` | Digantikan `get_active_session_for_couple` (migration 006) |
| `create_game_session` (6-param) | Digantikan versi 8-param (migration 007) |
