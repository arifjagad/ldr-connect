# Snake Ladder — Game Documentation

Game ular tangga kooperatif untuk pasangan LDR. Setiap giliran pemain melempar dadu dan berjalan di papan 10×10. Mendarat di kotak challenge memunculkan pertanyaan Truth atau Dare yang harus dijawab/dikonfirmasi oleh pasangan.

---

## Mekanisme Game

- **Papan:** 100 kotak (1–100), zigzag dari bawah ke atas
- **Giliran:** bergantian; host selalu mulai duluan
- **Dadu:** 1–6; angka 6 → dapat lempar lagi setelah menyelesaikan challenge (jika ada)
- **Ular:** mendarat di kepala ular → turun ke ekor
- **Tangga:** mendarat di bawah tangga → naik ke atas
- **Challenge squares:** Truth (✦) atau Dare (⚡) — pertanyaan diambil dari pool AI
- **Menang:** pertama mencapai kotak 100 (jika melampaui 100 → bounced balik)

### Alur Giliran

```
Lempar dadu → Jalan → Ada challenge? → Tampilkan pertanyaan
                                      → Pemain lakukan/jawab
                                      → Pasangan konfirmasi → Giliran berikutnya
```

---

## Database Tables

| Tabel | Keterangan |
|---|---|
| `game_sessions` | Sesi game (`game_type = 'snake_ladder'`) |
| `game_questions` | Pool pertanyaan Truth & Dare |
| `coin_transactions` | Debit coin saat create/join |

### JSONB Columns di `game_sessions`

**`board_config`** — static, dibuat saat session create:
```json
{
  "snakes":     [{ "from": 16, "to": 6 }, ...],
  "ladders":    [{ "from": 4,  "to": 14 }, ...],
  "challenges": [{ "square": 7, "type": "dare" }, ...]
}
```

**`game_state`** — live state, update tiap giliran:
```json
{
  "current_turn":     "host",
  "host_position":    0,
  "partner_position": 0,
  "last_roll": {
    "player":      "host",
    "value":       4,
    "snake_from":  null,
    "ladder_from": null,
    "bounced":     false
  },
  "pending_challenge": {
    "player":    "host",
    "type":      "dare",
    "category":  "romantic",
    "question":  "...",
    "roll_again": false
  }
}
```

---

## API Routes

| Method | Route | Fungsi |
|---|---|---|
| `POST` | `/api/game/session/create` | Buat sesi baru (host) |
| `POST` | `/api/game/session/join` | Join sesi (partner) |
| `POST` | `/api/game/snake/questions/generate` | Generate pertanyaan AI |
| `POST` | `/api/game/snake/session/create` | Inisialisasi board config |
| `POST` | `/api/game/snake/session/[code]/roll` | Lempar dadu |
| `POST` | `/api/game/snake/session/[code]/confirm` | Konfirmasi challenge selesai |
| `GET`  | `/api/game/snake/session/active` | Cek sesi aktif user |

### RPCs (Supabase Functions)

- `roll_snake_ladder(p_session_code, p_user_id)` — atomic dice roll + move
- `confirm_snake_challenge(p_session_code, p_user_id)` — konfirmasi challenge
- `create_game_session(...)` — buat sesi + debit coin host
- `join_game_session(...)` — join sesi + debit coin partner

---

## Components

```
components/games/snake-ladder/
  PhaserBoard.tsx     ← Papan Phaser.js dengan animasi pion
  SnakeBoard.tsx      ← Papan fallback SVG (CSS grid)
  Dice.tsx            ← Komponen dadu interaktif
  ChallengeModal.tsx  ← Modal pertanyaan Truth/Dare
```

### Pages

```
app/dashboard/games/snake/page.tsx   ← Halaman utama game
app/api/game/snake/                  ← API routes
```

---

## Realtime Events (Supabase)

Channel: `game:{session_code}`

| Event | Payload |
|---|---|
| `roll` | `{ player, value, new_position, snake_from?, ladder_from?, bounced? }` |
| `challenge` | `{ player, type, question, roll_again }` |
| `challenge_confirmed` | `{ next_turn }` |
| `game_over` | `{ winner }` |

---

## Coin Cost

| Peran | Biaya |
|---|---|
| Host (create) | 2 coin |
| Partner (join) | 2 coin |

Lihat `game_settings` table, `game_type = 'snake_ladder'`.

---

## Seed Data

- Pertanyaan: `supabase/migrations/005_snake_questions_seed.sql`
- Board config di-generate dinamis saat session create (tidak di-seed)

---

## Roadmap

- [x] MVP: Papan, dadu, challenge, animasi Phaser
- [ ] Sound effects
- [ ] Custom board config (host pilih jumlah ular/tangga)
- [ ] Leaderboard & history statistik
