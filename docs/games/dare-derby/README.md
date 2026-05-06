# 🎲 Dare Derby
### Mini-game Multiplayer untuk Pasangan LDR

> **Bagian dari LDR-Connect** — Platform game interaktif untuk pasangan jarak jauh.

---

## 📖 Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Cara Kerja Game](#cara-kerja-game)
3. [Sistem Mini-game](#sistem-mini-game)
4. [Sistem Dare](#sistem-dare)
5. [Alur Session Lengkap](#alur-session-lengkap)
6. [Arsitektur Mini-game](#arsitektur-mini-game)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Real-time Events](#real-time-events)
10. [Frontend Components](#frontend-components)
11. [Roadmap Mini-game](#roadmap-mini-game)
12. [Panduan Menambah Mini-game Baru](#panduan-menambah-mini-game-baru)

---

## Gambaran Umum

Dare Derby adalah game kompetitif berbasis ronde antara dua pemain (pasangan). Setiap ronde, keduanya memainkan **mini-game yang sama secara bersamaan**. Yang kalah mendapat **dare** dari partner — dan harus menyelesaikannya secara live sebelum ronde berikutnya dimulai.

### Karakteristik Utama

- **Asimetri hasil, bukan asimetri game** — keduanya main game yang sama, hasilnya yang berbeda
- **Dare bersifat real** — bukan sekadar jawab teks, tapi aksi nyata yang dikonfirmasi partner
- **Random mini-game** — dari pool 30 game, diambil acak 5–10 per session
- **Session-based** — satu session = 5 ronde (bisa dikustomisasi)

---

## Cara Kerja Game

### Alur Dasar per Ronde

```
1. COUNTDOWN       → Keduanya lihat "3... 2... 1... GO!"
2. MINI-GAME       → Keduanya main game yang sama, real-time
3. RESULT          → Skor muncul, ditentukan siapa kalah
4. DARE PHASE      → Yang kalah dapat dare, harus lakuin sekarang
5. KONFIRMASI      → Partner tap ✅ setelah dare selesai
6. LANJUT          → Ronde berikutnya dimulai
```

### Aturan Skor

| Kondisi | Hasil |
|---|---|
| Player A skor lebih tinggi | Player B kena dare |
| Skor sama (draw) | Ronde diulang sekali |
| Player tidak respond 10 detik | Auto-lose, kena dare |
| Dare tidak dikonfirmasi 5 menit | Dare di-skip, poin penalti |

### Sistem Poin Akhir

Pemenang session = yang paling **sedikit** kena dare.

```
Jika dare sama → lihat total skor mini-game akumulasi
Jika masih sama → draw, keduanya dapat achievement "Setara Banget"
```

---

## Sistem Mini-game

### Kategori Mini-game

Dari 30 mini-game yang tersedia, dibagi 3 kategori:

#### ⚡ REFLEX (10 game)
Game berbasis kecepatan reaksi fisik.

| ID | Nama | Deskripsi Singkat |
|---|---|---|
| `tap_timing` | Perfect Tap | Tap saat bar berada di zona merah |
| `reaction_btn` | React! | Tap tombol secepat mungkin saat muncul |
| `double_tap` | Double Tap | Tap 2x tepat saat sinyal muncul |
| `hold_release` | Hold & Release | Tahan tombol, lepas tepat di timing yang ditentukan |
| `swipe_dir` | Swipe Cepat | Swipe sesuai arah panah yang muncul |
| `multi_tap` | Tap Frenzy | Tap sebanyak mungkin dalam 5 detik |
| `avoid_tap` | Jangan Tap! | Jangan tap tombol merah, tap hanya yang hijau |
| `rhythm_tap` | Ketukan | Ikuti irama ketukan yang ditampilkan |
| `balance_hold` | Tahan! | Tahan tekanan di layar agar bar tetap di tengah |
| `speed_count` | Hitung Cepat | Tap sesuai jumlah angka yang muncul |

#### 🧠 BRAIN (10 game)
Game berbasis memori dan logika.

| ID | Nama | Deskripsi Singkat |
|---|---|---|
| `memory_seq` | Ingat Urutan | Ingat dan ulangi urutan warna |
| `pattern_copy` | Tiru Pola | Tiru pola grid yang menyala |
| `number_order` | Urutan Angka | Tap angka 1–9 secara urut dari yang berserakan |
| `color_memory` | Ingat Warna | Ingat warna kotak, jawab setelah hilang |
| `simon_says` | Simon Says | Ikuti instruksi hanya jika diawali "Simon says" |
| `pair_match` | Pasangkan | Pasangkan emoji/kata yang memiliki hubungan |
| `odd_one_out` | Yang Berbeda | Temukan 1 item yang tidak sesuai kelompok |
| `missing_num` | Angka Hilang | Temukan angka yang hilang dari deret |
| `word_chain` | Rantai Kata | Lanjutkan rantai kata (kata baru diawali huruf terakhir) |
| `visual_diff` | Temukan Beda | Temukan perbedaan antara dua tampilan |

#### 🎯 SKILL (10 game)
Game berbasis kemampuan dan pengetahuan.

| ID | Nama | Deskripsi Singkat |
|---|---|---|
| `word_scramble` | Acak Kata | Susun huruf acak menjadi kata |
| `emoji_match` | Tebak Emoji | Tebak kata/frasa dari kombinasi emoji |
| `sentence_fill` | Isi Kalimat | Isi bagian kalimat yang dikosongkan |
| `riddle_quick` | Tebak-tebakan | Jawab tebak-tebakan dalam waktu terbatas |
| `true_false` | Benar/Salah | Tentukan apakah pernyataan benar atau salah |
| `category_sort` | Sortir | Masukkan item ke kategori yang benar |
| `math_fast` | Hitung! | Selesaikan soal matematika sederhana dengan cepat |
| `anagram` | Anagram | Temukan kata dari huruf yang sama dengan kata lain |
| `first_letter` | Huruf Pertama | Tebak kata dari huruf pertama dan petunjuk singkat |
| `type_fast` | Ketik Cepat | Ketik kalimat pendek secepat mungkin tanpa salah |

### Mekanisme Random

Saat session dibuat, sistem memilih mini-game secara **balanced random**:

```
5 ronde  → 2 Reflex + 2 Brain + 1 Skill
7 ronde  → 3 Reflex + 2 Brain + 2 Skill
10 ronde → 4 Reflex + 3 Brain + 3 Skill
```

Mini-game yang sama tidak boleh muncul 2x dalam satu session. History mini-game per pasangan disimpan agar tidak terlalu sering repeat dalam 3 session berturut-turut.

---

## Sistem Dare

### Sumber Dare

Dare bisa berasal dari tiga sumber:

```
1. POOL ADMIN    → Dare default dari database (kurated)
2. CUSTOM DARE   → Dare yang ditulis pasangan sebelum game mulai
3. DARE LAMA     → Dare yang belum selesai dari session sebelumnya (opsional)
```

### Kategori Dare

| Kategori | Contoh | Level |
|---|---|---|
| `sweet` | "Kirim voice note bilang I love you" | 🟢 Ringan |
| `funny` | "Foto ekspresi paling jelek, kirim sekarang" | 🟡 Seru |
| `bold` | "Screenshot notif terakhir dan kirimin" | 🟠 Berani |
| `challenge` | "Nyanyi 1 bait lagu favorit kita via voice note" | 🔴 Challenge |

### Level Dare

Pasangan bisa set level dare sebelum game dimulai:

```
SWEET ONLY    → Hanya dare kategori sweet
MIXED (default) → Campur sweet + funny + bold
FULL CHAOS    → Semua kategori termasuk challenge
```

### Alur Dare Phase

```
┌─────────────────────────────────────────────────┐
│  Yang kalah dapat dare                          │
│  ↓                                              │
│  Dare muncul di layar keduanya                  │
│  ↓                                              │
│  Yang kalah lakuin dare (via WA/chat/langsung)  │
│  ↓                                              │
│  Yang kalah tap "Sudah Selesai ✅"              │
│  ↓                                              │
│  Partner konfirmasi "Ya, Sudah ✅" atau         │
│                      "Belum, Ulangi 🔁"         │
│  ↓                                              │
│  Kalau dikonfirmasi → lanjut ronde berikutnya   │
└─────────────────────────────────────────────────┘
```

### Skip Dare

Pemain bisa skip dare dengan konsekuensi:

- Skip 1x → tidak ada penalti (tapi tercatat)
- Skip 2x → lawan dapat bonus 50 poin di ronde berikutnya
- Skip 3x → session berakhir, otomatis kalah

---

## Alur Session Lengkap

### 1. Pre-game Setup

```
Host buat session
  → Pilih jumlah ronde (5 / 7 / 10)
  → Pilih level dare (Sweet / Mixed / Full Chaos)
  → Pilih apakah mau tambah custom dare (opsional)
  → Generate session code (6 digit)

Partner join pakai session code
  → Keduanya di lobby
  → Keduanya tap "Siap!"
  → Countdown 3 detik → Game mulai
```

### 2. In-game Flow

```
RONDE 1
  ├── Announce mini-game ("⚡ Perfect Tap!")
  ├── Tutorial singkat 3 detik (kalau first time game ini)
  ├── Countdown "3... 2... 1... GO!"
  ├── Mini-game berlangsung (5–30 detik tergantung game)
  ├── Result screen (skor masing-masing)
  ├── Dare phase (jika ada yang kalah)
  └── "Ronde 2 dimulai dalam 5 detik..."

RONDE 2–5
  └── (sama seperti ronde 1)

GAME OVER
  ├── Rekap semua ronde
  ├── Total dare masing-masing
  ├── Pemenang diumumkan
  └── Achievement + opsi rematch
```

### 3. Post-game

```
Result screen tampilkan:
  - Skor total tiap ronde
  - Dare yang didapat masing-masing
  - MVP mini-game (game yang paling jago)
  - Achievement yang unlock
  - Tombol: Rematch | Ganti Game | Lihat History
```

---

## Arsitektur Mini-game

### Interface Standar

Setiap mini-game **wajib** mengimplementasikan interface berikut:

```typescript
interface MiniGame {
  id: string
  name: string
  category: 'reflex' | 'brain' | 'skill'
  duration: number          // durasi dalam detik
  instructions: string      // teks instruksi singkat (maks 20 kata)
  
  // Lifecycle hooks
  onStart: () => void
  onEnd: () => GameResult
  onTimeout: () => GameResult
  
  // Scoring
  calculateScore: (performance: PlayerPerformance) => number  // 0–100
}

interface GameResult {
  score: number             // 0–100
  timeTaken: number         // dalam milidetik
  metadata: Record<string, any>  // data tambahan spesifik game
}
```

### Contoh Implementasi: Tap Timing

```typescript
// components/mini-games/TapTimingGame.tsx

const TapTimingGame: MiniGame = {
  id: 'tap_timing',
  name: 'Perfect Tap',
  category: 'reflex',
  duration: 10,
  instructions: 'Tap tepat saat bar berada di zona merah!',

  onStart() {
    // Mulai animasi bar bergerak
    startBarAnimation({ speed: 'medium' })
  },

  onEnd() {
    const tapPosition = getLastTapPosition()
    const score = calculateZoneScore(tapPosition)
    return { score, timeTaken: getElapsed(), metadata: { tapPosition } }
  },

  onTimeout() {
    return { score: 0, timeTaken: 10000, metadata: { reason: 'timeout' } }
  },

  calculateScore(perf) {
    // Zona merah = 100, kuning = 70, hijau = 40, miss = 0
    if (perf.inRedZone) return 100
    if (perf.inYellowZone) return 70
    if (perf.inGreenZone) return 40
    return 0
  }
}
```

### State Machine Session

```
IDLE → LOBBY → COUNTDOWN → PLAYING → RESULT → DARE → NEXT_ROUND
                                                  ↓
                                            GAME_OVER (ronde habis)
```

---

## Database Schema

### Tabel Utama

```sql
-- Pool dare dari admin
CREATE TABLE public.game_dare_questions (
  id         BIGSERIAL   PRIMARY KEY,
  category   VARCHAR(20) NOT NULL CHECK (category IN ('sweet', 'funny', 'bold', 'challenge')),
  content    TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Config mini-game (metadata)
CREATE TABLE public.game_minigame_configs (
  id         BIGSERIAL    PRIMARY KEY,
  game_id    VARCHAR(50)  UNIQUE NOT NULL,   -- 'tap_timing', 'memory_seq', dll
  name       VARCHAR(100) NOT NULL,
  category   VARCHAR(10)  NOT NULL CHECK (category IN ('reflex', 'brain', 'skill')),
  duration   INTEGER      NOT NULL,          -- durasi dalam detik
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  config     JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- config tambahan per game
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Perlu update CHECK constraint di game_sessions:
-- ALTER TABLE public.game_sessions DROP CONSTRAINT game_sessions_game_type_check;
-- ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_game_type_check
--   CHECK (game_type IN ('tod', 'snake_ladder', 'quiz', 'dare_derby'));

-- Session Dare Derby menggunakan game_sessions yang sudah ada (game_type = 'dare_derby')
--
-- board_config menyimpan:
-- {
--   "total_rounds": 5,
--   "dare_level": "mixed",
--   "custom_dares": [],
--   "minigame_sequence": ["tap_timing", "memory_seq", "word_scramble", "reaction_btn", "true_false"]
-- }
--
-- game_state menyimpan:
-- {
--   "phase": "lobby",           -- lobby | playing | result | game_over
--   "current_round": 1,
--   "ready": { "host": false, "partner": false },
--   "round_submissions": { "host": null, "partner": null },
--   "skip_counts": { "host": 0, "partner": 0 },
--   "dare_counts": { "host": 0, "partner": 0 },
--   "is_replay_round": false,
--   "pending_bonus_for": null,
--   "last_round_result": null
-- }
--
-- questions (JSONB array) menyimpan hasil tiap ronde:
-- [
--   {
--     "round_number": 1,
--     "minigame_id": "tap_timing",
--     "host_score": 94,
--     "partner_score": 71,
--     "loser": "partner",
--     "dare_id": 12,
--     "dare_content": "Kirim voice note bilang I love you",
--     "dare_category": "sweet",
--     "dare_status": "completed",    -- pending | awaiting_confirm | completed | skipped
--     "confirmed_at": "2024-01-01T10:05:00Z"
--   }
-- ]
```

### Relasi ke Tabel Existing

```
game_sessions
  ├── game_type        = 'dare_derby'
  ├── couple_id        = LEAST(host_user_id, partner_user_id)
  ├── host_user_id     → users.id
  ├── partner_user_id  → users.id
  ├── board_config     → { total_rounds, dare_level, minigame_sequence, ... }
  ├── game_state       → { phase, current_round, submissions, skip_counts, ... }
  └── questions        → array hasil tiap ronde (round_result[])
```

---

## API Endpoints

### Session Management

```
POST   /api/dare-derby/session/create
       Body: { couple_id, total_rounds, dare_level, custom_dares[] }
       Response: { session_id, session_code, expires_at }

POST   /api/dare-derby/session/join
       Body: { session_code }
       Response: { session_id, player_role, settings }

GET    /api/dare-derby/session/{id}
       Response: { session, current_round, scores, status }

DELETE /api/dare-derby/session/{id}/leave
```

### Round Management

```
GET    /api/dare-derby/session/{id}/round/{n}
       Response: { minigame_id, minigame_config, dare_pool }

POST   /api/dare-derby/session/{id}/round/{n}/submit
       Body: { score, time_taken, metadata }
       Response: { result, loser, dare }

POST   /api/dare-derby/session/{id}/round/{n}/dare/complete
       Body: { player_id }
       Response: { waiting_confirmation: true }

POST   /api/dare-derby/session/{id}/round/{n}/dare/confirm
       Body: { confirmed: true | false }
       Response: { next_round | repeat_dare }

POST   /api/dare-derby/session/{id}/round/{n}/dare/skip
       Response: { skip_count, penalty_applied }
```

### Mini-game & Dare Content

```
GET    /api/dare-derby/minigames
       Response: { games[] } — list semua game aktif

GET    /api/dare-derby/dares?category=sweet&level=mixed
       Response: { dares[] }
```

---

## Real-time Events

Menggunakan **Supabase Realtime** (atau Laravel Broadcasting + Pusher).

### Channel

```
Channel: dare-derby.{session_id}
```

### Events yang Di-broadcast

```javascript
// Kedua player siap → mulai countdown
{ event: 'both_ready', data: { starts_in: 3 } }

// Countdown tiap detik
{ event: 'countdown', data: { count: 3 | 2 | 1 } }

// Mini-game dimulai
{ event: 'round_start', data: { round: 1, minigame_id: 'tap_timing' } }

// Salah satu player submit hasil
{ event: 'player_submitted', data: { player_id, score } }

// Kedua submit → tampilkan result
{ event: 'round_result', data: { p1_score, p2_score, loser, dare } }

// Dare selesai dilakukan
{ event: 'dare_completed', data: { player_id } }

// Partner konfirmasi dare
{ event: 'dare_confirmed', data: { confirmed: true } }

// Dare di-skip
{ event: 'dare_skipped', data: { player_id, skip_count } }

// Ronde berikutnya dimulai
{ event: 'next_round', data: { round: 2, starts_in: 5 } }

// Game selesai
{ event: 'game_over', data: { winner_id, final_scores, achievements } }

// Player disconnect
{ event: 'player_disconnected', data: { player_id, reconnect_window: 30 } }
```

---

## Frontend Components

### Struktur Folder

```
/components/games/dare-derby/
  ├── DareDerbyLobby.tsx          // Pre-game setup + waiting room
  ├── DareDerbyCountdown.tsx      // Countdown 3-2-1
  ├── DareDerbyResult.tsx         // Result per ronde
  ├── DareDerbyDarePhase.tsx      // Tampilan dare + konfirmasi
  ├── DareDerbyGameOver.tsx       // Result akhir + achievements
  │
  ├── mini-games/
  │   ├── _base/
  │   │   ├── MiniGameWrapper.tsx  // Shell: timer, instruksi, skor
  │   │   └── useMiniGame.ts      // Hook: lifecycle, scoring, sync
  │   │
  │   ├── reflex/
  │   │   ├── TapTimingGame.tsx
  │   │   ├── ReactionButtonGame.tsx
  │   │   └── ... (8 game lainnya)
  │   │
  │   ├── brain/
  │   │   ├── MemorySequenceGame.tsx
  │   │   ├── PatternCopyGame.tsx
  │   │   └── ... (8 game lainnya)
  │   │
  │   └── skill/
  │       ├── WordScrambleGame.tsx
  │       ├── EmojiMatchGame.tsx
  │       └── ... (8 game lainnya)
  │
  └── index.tsx                   // Entry point, handle routing antar phase
```

### useMiniGame Hook

```typescript
// Hook utama yang dipakai semua mini-game
const useMiniGame = (gameId: string) => {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)

  const submitScore = async (score: number, metadata?: any) => {
    // Kirim ke server + broadcast ke partner
    await api.submitRoundScore({ score, metadata })
  }

  return { phase, score, timeLeft, submitScore }
}
```

---

## Roadmap Mini-game

### MVP — 5 Game (Launch)

- [x] `tap_timing` — Perfect Tap
- [x] `memory_seq` — Ingat Urutan
- [x] `word_scramble` — Acak Kata
- [x] `reaction_btn` — React!
- [x] `true_false` — Benar/Salah

### v1.1 — +5 Game

- [ ] `pattern_copy` — Tiru Pola
- [ ] `number_order` — Urutan Angka
- [ ] `emoji_match` — Tebak Emoji
- [ ] `double_tap` — Double Tap
- [ ] `math_fast` — Hitung!

### v1.2 — +5 Game

- [ ] `simon_says` — Simon Says
- [ ] `swipe_dir` — Swipe Cepat
- [ ] `riddle_quick` — Tebak-tebakan
- [ ] `pair_match` — Pasangkan
- [ ] `type_fast` — Ketik Cepat

### v1.3–v1.6 — Sisa 15 Game

- [ ] Dilanjutkan bertahap sesuai feedback user

---

## Panduan Menambah Mini-game Baru

Ikuti langkah ini setiap kali ingin menambah mini-game:

### Step 1 — Tambah Config di Database

```sql
INSERT INTO game_minigame_configs (game_id, name, category, duration, config)
VALUES (
  'nama_game',
  'Nama Tampilan',
  'reflex',   -- atau 'brain' / 'skill'
  10,         -- durasi dalam detik
  '{"difficulty": "medium"}'
);
```

### Step 2 — Buat Component

```typescript
// /components/games/dare-derby/mini-games/reflex/NamaGame.tsx

export default function NamaGame({ onComplete }: { onComplete: (score: number) => void }) {
  const { timeLeft } = useMiniGame('nama_game')

  const handleAction = () => {
    const score = hitungSkor()
    onComplete(score)
  }

  return (
    <MiniGameWrapper gameId="nama_game" timeLeft={timeLeft}>
      {/* UI game di sini */}
      <button onClick={handleAction}>Tap!</button>
    </MiniGameWrapper>
  )
}
```

### Step 3 — Daftarkan di Registry

```typescript
// /lib/minigame-registry.ts

import NamaGame from '@/components/games/dare-derby/mini-games/reflex/NamaGame'

export const MINIGAME_REGISTRY = {
  // ... game lainnya
  nama_game: NamaGame,
}
```

### Step 4 — Test

```
1. Buka session Dare Derby di dev
2. Force game_id = 'nama_game' di query param
3. Pastikan:
   - Game tampil dengan benar
   - Skor ter-submit ke server
   - Partner menerima result
   - Dare phase berjalan normal
```

Setelah 4 step ini selesai, game langsung masuk ke random pool dan bisa muncul di session berikutnya.

---

## Catatan Tambahan

### Handling Disconnect

Jika salah satu player disconnect saat mini-game berlangsung:
- Tunggu 30 detik untuk reconnect
- Jika reconnect → lanjut dari state terakhir
- Jika tidak reconnect → player yang disconnect otomatis kalah ronde tersebut
- Jika host disconnect → session di-pause, notif ke partner

### Cheat Prevention

- Skor dihitung di **server**, bukan client
- Client hanya kirim raw input (tap position, tap time, jawaban)
- Server yang tentukan apakah input valid dan berapa skornya
- Timestamp tiap input divalidasi ± toleransi 500ms dari server time

### Coin Cost

```
5 ronde  = 3 coin
7 ronde  = 4 coin
10 ronde = 6 coin
```

Coin dipotong saat session **start** (kedua player sudah ready), bukan saat create.

---

*README ini akan diupdate seiring perkembangan game. Versi terakhir: v0.1.0*
