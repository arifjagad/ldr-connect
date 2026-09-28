# LDR-Connect — Database Schema

Folder ini adalah **state akhir database** yang disusun per kategori. Pakai folder ini untuk membuat database baru dari nol. Folder `migrations/` tetap ada sebagai riwayat perubahan satu per satu.

## Setup database baru

Jalankan di Supabase SQL Editor **berurutan**: semua file schema dulu, lalu seed.

| Urutan | File | Isi |
|---|---|---|
| 1 | `00_common.sql` | `update_updated_at_column()` untuk trigger `updated_at` |
| 2 | `01_accounts_couple.sql` | `users`, `admin_activity_logs`, trigger signup, proteksi kolom sensitif, helper RLS (`get_my_partner_id`, `is_admin`), `get_couple_id`, `link_couple`/`unlink_couple`, bucket `avatars` |
| 3 | `02_coin_payment.sql` | `wallets`, `coin_packages`, `coin_transactions`, `vouchers`, `voucher_redemptions`, RPC topup/Midtrans/voucher, realtime saldo |
| 4 | `03_rate_limiting.sql` | `rate_limit_events`, `check_and_record_rate_limit`, limiter login 2-tier |
| 5 | `04_games_core.sql` | `game_settings`, `game_sessions`, create/join/cancel/refund/expire sesi, sesi aktif couple |
| 6 | `05_game_tod.sql` | `game_tod_questions`, `answer_tod_question` |
| 7 | `06_game_snake_ladder.sql` | `game_snake_questions`, `roll_snake_dice`, `confirm_snake_challenge` |
| 8 | `07_game_dare_derby.sql` | `game_dare_questions`, `game_minigame_configs`, RPC ronde & dare |
| 9 | `08_game_quoridor.sql` | `quoridor_has_path`, `quoridor_action` |
| 10 | `09_game_photobooth.sql` | `game_photobooth_templates`, bucket `photobooth` (publik) & `photobooth-captures` (privat), `photobooth_action` |
| 11 | `10_couple_features.sql` | `anniversaries`, `wishlists`, `capsules` |
| 12 | `11_push_notifications.sql` | `push_subscriptions` |
| 13 | `seed/01_game_settings.sql` … `seed/07_photobooth_templates.sql` | Data awal: setting game, paket coin, voucher dummy, mini-game & dare, pertanyaan ToD & Ular Tangga, template Photobooth |

Setiap file memuat semua hal untuk kategorinya: tabel, index, trigger, RLS & policy, fungsi, `REVOKE`, dan publication realtime.

`seed/03_vouchers_dummy.sql` berisi voucher untuk **testing**. Hapus atau ubah dulu sebelum dipakai di production.

## Mengubah database

1. Buat migration baru di `migrations/` dengan nomor berikutnya (`044_...sql`), lalu jalankan di production.
2. Terapkan perubahan yang sama ke file kategori yang sesuai di folder ini, supaya `schema/` tetap sama dengan production.
3. RPC `SECURITY DEFINER` baru yang hanya dipanggil dari API route **wajib** di-`REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` di file yang sama (lihat `CLAUDE.md` § RPC Server-Only).

## Asal isi dari migrations

| Migration | Ada di |
|---|---|
| 001–003, 010–013 (tabel inti, RLS, fungsi, rate limit, expiry sesi) | `01`–`06` sesuai kategori |
| 004, 005 (seed pertanyaan) | `seed/05`, `seed/06` |
| 006–009 (Ular Tangga pindah ke `game_sessions`, fungsi lama di-drop) | `04_games_core`, `06_game_snake_ladder` |
| 014–019, 030 (Dare Derby) | `07_game_dare_derby`, `seed/04` |
| 020–021 (vouchers + diskon topup, anniversary dibuka ke partner) | `02_coin_payment`, `10_couple_features`, `seed/03` |
| 022–023, 029 (wishlists, capsules) | `10_couple_features` |
| 024–027 (Quoridor) | `08_game_quoridor` |
| 028 (limiter login) | `03_rate_limiting` |
| 029_fix_voucher_redemption_ref | `02_coin_payment` (`redeem_voucher`) |
| 031, 035 (cancel/expire topup, topup atomik) | `02_coin_payment` |
| 032 (realtime `wallets` & `coin_transactions`) | `02_coin_payment` |
| 033, 034, 040, 041 (Photobooth) | `09_game_photobooth`, `seed/01`, `seed/07` |
| 036 (proteksi kolom `users`, hardening link/unlink) | `01_accounts_couple` |
| 037 (RLS capsules, proteksi owner anniversary) | `10_couple_features` |
| 038 (lock create sesi, refund auto-expire, skip ToD) | `04_games_core`, `05_game_tod` |
| 039 (`REVOKE` RPC server-only) | di samping masing-masing fungsi |
| 042 (unlink bereskan sesi, signup atomik) | `01_accounts_couple` |
| 043 (bucket `avatars`) | `01_accounts_couple` |
| `add_avatar_url`, `push_subscriptions` | `01_accounts_couple`, `11_push_notifications` |

## Beda `schema/` dengan menjalankan ulang `migrations/`

Production dibangun dari folder schema lama lalu diberi migration yang lebih baru, jadi `schema/` inilah yang mencerminkan production, bukan replay `migrations/` dari 001. Replay migrations menghasilkan beberapa perbedaan kecil:

- Nama index berbeda (misal `idx_game_sessions_*` di migrations vs `idx_gs_*` di sini), begitu juga nama beberapa policy `vouchers`, `voucher_redemptions`, `push_subscriptions`. Aturannya sama.
- `vouchers.created_at`, `voucher_redemptions.redeemed_at`, `push_subscriptions.created_at` `NOT NULL` di sini (sama dengan production), nullable di migrations. `vouchers.type` punya CHECK di sini.
- Replay migrations masih menyisakan fungsi lama yang tidak ada di production: `validate_topup_voucher`, `answer_tod_question` 3 parameter, `get_active_session_for_couple` 1 parameter.

`migrations/` juga tidak bisa dijalankan ulang apa adanya: `003` bergantung pada tabel `game_snake_sessions` yang sudah dihapus dari `001`, `020b` harus jalan setelah `021_discount_vouchers`, dan `029_capsules` mendaftarkan ulang `capsules` ke publication. Untuk database baru, selalu pakai folder ini.

## Verifikasi

Saat disusun ulang (migration 043), isi folder ini dibandingkan secara otomatis dengan schema lama + migration yang belum digabung (029_fix, 032, 033, 034, 041, 042, 043) di Postgres lokal. Hasilnya identik: tabel, kolom, constraint, index, fungsi, policy, trigger, hak akses fungsi, publication realtime, bucket Storage, dan isi seed.

## Fungsi yang sudah dihapus

| Fungsi | Pengganti |
|---|---|
| `create_snake_session`, `join_snake_session`, `get_active_snake_session_for_couple` | `create_game_session`, `join_game_session`, `get_active_session_for_couple` (migration 006) |
| `create_game_session` 6 parameter | Versi 8 parameter (migration 007) |
| `validate_topup_voucher` | Endpoint `/api/coin/check-voucher` |

## Tabel aktif

| Tabel | File |
|---|---|
| `users`, `admin_activity_logs` | `01_accounts_couple` |
| `wallets`, `coin_packages`, `coin_transactions`, `vouchers`, `voucher_redemptions` | `02_coin_payment` |
| `rate_limit_events` | `03_rate_limiting` |
| `game_settings`, `game_sessions` | `04_games_core` |
| `game_tod_questions` | `05_game_tod` |
| `game_snake_questions` | `06_game_snake_ladder` |
| `game_dare_questions`, `game_minigame_configs` | `07_game_dare_derby` |
| `game_photobooth_templates` | `09_game_photobooth` |
| `anniversaries`, `wishlists`, `capsules` | `10_couple_features` |
| `push_subscriptions` | `11_push_notifications` |
