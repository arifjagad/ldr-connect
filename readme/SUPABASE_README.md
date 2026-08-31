# Supabase Schema — LDR-Connect

## Urutan Eksekusi

Jalankan file-file ini berurutan di **Supabase SQL Editor**
(Dashboard → SQL Editor → New Query):

| Urutan | File | Isi |
|--------|------|-----|
| 1 | `migrations/001_tables.sql` | Semua tabel, index, triggers, seed game_settings & coin_packages |
| 2 | `migrations/002_rls_policies.sql` | Row Level Security policies |
| 3 | `migrations/003_functions.sql` | Stored functions (business logic) |
| 4 | `migrations/004_tod_questions_seed.sql` | Seed ~60 pertanyaan Truth or Dare |

---

## Struktur Tabel

```
users               — Profile user (extends auth.users), couple_code, partner_id
wallets             — Saldo coin per user (1:1 dengan users)
coin_packages       — Paket top-up (20/50/100/200 coin)
coin_transactions   — Riwayat topup & deduct coin
game_tod_questions  — Pool pertanyaan Truth or Dare
game_sessions       — Sesi game aktif (semua game type)
anniversaries       — Pengingat hari spesial pasangan
admin_activity_logs — Audit trail admin
game_settings       — Konfigurasi game (coin cost, expiry)
```

---

## Perbedaan dari Laravel Schema

| Aspek | Laravel (MySQL) | Supabase (PostgreSQL) |
|-------|----------------|----------------------|
| User ID | `BIGINT auto-increment` | `UUID` (dari `auth.users`) |
| JSON columns | `JSON` | `JSONB` (lebih efisien + indexable) |
| Timestamps | `TIMESTAMP` | `TIMESTAMPTZ` (timezone-aware) |
| `couple_id` | `UNSIGNED BIGINT` | `UUID` |
| Auto-create profile | Eloquent model boot | Trigger `on_auth_user_created` |
| Business logic | Service classes PHP | Stored functions PostgreSQL |

---

## Stored Functions (dipanggil via `supabase.rpc()`)

| Function | Dipanggil dari | Keterangan |
|----------|----------------|------------|
| `get_couple_id(user_id)` | Internal | Hitung `LEAST(user_id, partner_id)` |
| `link_couple(user_id, couple_code)` | `POST /api/couple/link` | Link dua user, atomic |
| `unlink_couple(user_id)` | `POST /api/couple/unlink` | Unlink pasangan, atomic |
| `create_game_session(...)` | `POST /api/game/tod/session/create` | Deduct coin + buat sesi, atomic |
| `join_game_session(...)` | `POST /api/game/tod/session/join` | Partner join sesi |
| `answer_tod_question(...)` | `POST /api/game/tod/session/{code}/done` | Tandai selesai + ambil next |
| `refund_expired_session(session_id)` | API route / cron | Refund coin sesi expired |
| `expire_waiting_sessions()` | Cron job | Expire semua sesi waiting yang timeout |
| `update_payment_status(...)` | `POST /api/coin/webhook` | Update status + tambah saldo |
| `get_pending_topup_count(user_id)` | `POST /api/coin/topup` | Rate limiting topup |
| `get_active_session_for_couple(...)` | API route | Cek sesi aktif sebelum buat baru |

---

## RLS — Siapa Bisa Akses Apa

| Tabel | Read | Insert | Update | Delete |
|-------|------|--------|--------|--------|
| `users` | Sendiri + partner | Trigger only | Sendiri | — |
| `wallets` | Sendiri + partner | Trigger only | Service role | — |
| `coin_packages` | All (active only) | — | — | — |
| `coin_transactions` | Sendiri | Service role | Service role | — |
| `game_tod_questions` | Active + couple | User (is_active=false) | Admin | — |
| `game_sessions` | Host + partner | Service role | Service role | — |
| `anniversaries` | Sendiri | Sendiri | Sendiri | Sendiri |
| `admin_activity_logs` | Admin only | Service role | — | — |
| `game_settings` | All authenticated | — | Admin | — |

---

## Supabase Realtime

Tabel `game_sessions` sudah didaftarkan ke `supabase_realtime` publication.

Subscribe dari client (Next.js):
```typescript
const channel = supabase
  .channel(`game-session-${sessionCode}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'game_sessions',
      filter: `session_code=eq.${sessionCode}`,
    },
    (payload) => {
      // payload.new = data sesi terbaru
    }
  )
  .subscribe()
```

---

## Catatan Penting

1. **Service Role Key** — Semua API routes Next.js yang melakukan write/complex logic harus menggunakan `SUPABASE_SERVICE_ROLE_KEY` (bukan anon key). Key ini **hanya boleh di server** (env tanpa `NEXT_PUBLIC_`).

2. **Anon Key** — Digunakan di client-side untuk auth dan read operations yang dilindungi RLS.

3. **`couple_id` convention** — Selalu `LEAST(user_id, partner_id)`. Karena sekarang UUID, perbandingan UUID di PostgreSQL bekerja secara lexicographic.

4. **Auth flow** — Supabase Auth akan otomatis membuat entry di `auth.users`. Trigger `on_auth_user_created` akan otomatis membuat row di `public.users` dan `public.wallets`.
