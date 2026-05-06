# Truth or Dare — Game Documentation

Game Truth or Dare untuk pasangan LDR. Pemain bergantian mendapat pertanyaan Truth atau tantangan Dare yang di-generate oleh AI berdasarkan kategori yang dipilih. Cocok dimainkan via video call bersama.

---

## Mekanisme Game

- **Sesi:** host buat room → partner join via kode
- **Giliran:** bergantian; host selalu mulai
- **Pertanyaan:** di-generate AI (GPT/Claude) berdasarkan kategori
- **Kategori:** romantic, fun, deep, spicy (bisa dikombinasi)
- **Selesai:** pemain klik "Done" setelah menjawab/melakukan → giliran berikutnya
- **Sesi berakhir:** salah satu klik "End Game" atau sesi expire (30 menit)

### Alur Sesi

```
Host pilih kategori → Buat room → Partner join
→ Giliran host: dapat pertanyaan → Jawab/lakukan → Done
→ Giliran partner: dapat pertanyaan → Jawab/lakukan → Done
→ Loop sampai salah satu end game
```

---

## Database Tables

| Tabel | Keterangan |
|---|---|
| `game_sessions` | Sesi game (`game_type = 'tod'`) |
| `game_questions` | Pool pertanyaan buatan user/admin |
| `game_categories` | Kategori pertanyaan |
| `coin_transactions` | Debit coin saat create/join |

### JSONB Columns di `game_sessions`

**`board_config`** — config awal sesi:
```json
{
  "categories": ["romantic", "fun"],
  "question_mode": "ai"
}
```

**`game_state`** — live state:
```json
{
  "current_turn": "host",
  "round_count": 5,
  "current_question": {
    "type": "truth",
    "category": "romantic",
    "content": "..."
  }
}
```

---

## API Routes

| Method | Route | Fungsi |
|---|---|---|
| `POST` | `/api/game/session/create` | Buat sesi baru (host) |
| `POST` | `/api/game/session/join` | Join sesi (partner) |
| `GET`  | `/api/game/tod/categories` | Ambil daftar kategori |
| `POST` | `/api/game/tod/questions/generate` | Generate pertanyaan AI |
| `POST` | `/api/game/tod/session/create` | Inisialisasi sesi ToD |
| `POST` | `/api/game/tod/session/[code]/next` | Pertanyaan berikutnya |
| `POST` | `/api/game/tod/session/[code]/done` | Tandai pertanyaan selesai |
| `POST` | `/api/game/tod/session/[code]/cancel` | Batalkan sesi |
| `GET`  | `/api/game/tod/session/active` | Cek sesi aktif user |

### RPCs (Supabase Functions)

- `create_game_session(...)` — buat sesi + debit coin host
- `join_game_session(...)` — join sesi + debit coin partner
- `cancel_game_session(...)` — batalkan sesi aktif

---

## Components

```
components/games/tod/      ← (belum ada, siap diisi)
```

### Pages

```
app/game/tod/              ← Halaman game publik
app/dashboard/games/tod/   ← Dashboard (buat sesi, lihat pertanyaan)
  questions/               ← Submit pertanyaan custom
app/api/game/tod/          ← API routes
```

---

## Realtime Events (Supabase)

Channel: `game:{session_code}`

| Event | Payload |
|---|---|
| `partner_joined` | `{ partner_id }` |
| `next_question` | `{ type, category, content, turn }` |
| `question_done` | `{ next_turn }` |
| `game_cancelled` | `{ cancelled_by }` |

---

## Coin Cost

| Peran | Biaya |
|---|---|
| Host (create) | 2 coin |
| Partner (join) | 2 coin |

Lihat `game_settings` table, `game_type = 'tod'`.

---

## Pertanyaan Custom

User bisa submit pertanyaan sendiri via `/dashboard/games/tod/questions`. Pertanyaan masuk ke `game_questions` dengan status pending → diapprove admin sebelum masuk pool.

API: `POST /api/game/tod/questions/submit`, `GET /api/game/tod/questions/my`

---

## Seed Data

- Pertanyaan default: `supabase/migrations/004_tod_questions_seed.sql`
- Kategori: tersimpan di `game_categories` table

---

## Roadmap

- [x] MVP: Sesi, pertanyaan AI, giliran bergantian
- [x] Pertanyaan custom dari user
- [ ] Statistik per kategori
- [ ] Mode "no repeat" (pertanyaan tidak diulang dalam 1 sesi)
- [ ] Reaction/emoji response per pertanyaan
