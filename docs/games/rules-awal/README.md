# Game Standards — Aturan Awal Semua Game

Dokumen ini mendefinisikan standar wajib yang harus dimiliki setiap game di LDR Connect. Ketiga game yang ada (Truth or Dare, Snake Ladder, Dare Derby) dan semua game baru harus mengikuti aturan ini.

---

## 1. Video Call

Setiap game **wajib** menyertakan tombol video call saat sesi aktif.

### Komponen
```tsx
import { VideoCall } from "@/components/VideoCall";
```

### State
```tsx
const [showVideo, setShowVideo] = useState(false);
```

### Tombol toggle (di header game)
```tsx
<button
  type="button"
  onClick={() => setShowVideo(v => !v)}
  title={showVideo ? "Tutup video call" : "Buka video call"}
  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
    showVideo
      ? "border-[#34D399]/40 bg-[#34D399]/15 text-[#34D399]"
      : "border-white/10 bg-white/5 text-[#5C5470] hover:text-[#9B93B0]"
  }`}
>
  {/* video icon svg */}
</button>
```

### Render VideoCall
```tsx
{showVideo && (
  <VideoCall
    sessionCode={session.session_code}
    game="<nama-game>"   // "tod" | "snake-ladder" | "dare-derby"
    onLeave={() => setShowVideo(false)}
  />
)}
```

### API endpoint room wajib ada
```
GET /api/game/<nama-game>/session/[code]/room
```
File: `app/api/game/<nama-game>/session/[code]/room/route.ts`  
Salin dari `app/api/game/tod/session/[code]/room/route.ts` — logikanya identik karena semua game pakai tabel `game_sessions` yang sama.

---

## 2. Share Kode via WhatsApp (Waiting Phase)

Di phase `waiting`, host **wajib** punya tombol berbagi kode sesi via WhatsApp.

```tsx
const shareText = `Yuk main <NamaGame> bareng aku di LDR-Connect! 🎲\nKode: ${session.session_code}\nLink: ${typeof window !== "undefined" ? window.location.origin : ""}/join/${session.session_code}`;

<a
  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
  target="_blank"
  rel="noopener noreferrer"
  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366]/15 border border-[#25D366]/20 px-5 py-2.5 text-sm font-semibold text-[#25D366] transition hover:bg-[#25D366]/25"
>
  {/* WhatsApp SVG icon */}
  Kirim via WhatsApp
</a>
```

Link join langsung: `/join/${session.session_code}` — partner bisa klik dan langsung masuk game.

---

## 3. Layout & Max-Width

Semua phase (idle, setup, waiting, game, finished) menggunakan wrapper yang sama:

```tsx
<div className="mx-auto w-full max-w-md px-4 py-6 flex flex-col gap-4">
```

| Phase | Max-width | Keterangan |
|---|---|---|
| idle / setup / waiting / finished | `max-w-md` (448px) | Tampilan vertikal terpusat |
| game (jika ada papan/board) | `max-w-[860px]` | Ruang lebih untuk board game |
| game (mini-game / kartu) | `max-w-md` | Tetap compact |

Tidak boleh ada game yang memakai lebar penuh (`w-full` tanpa `max-w-*`) tanpa pembungkus.

---

## 3. Struktur Header Saat Playing

Header di fase game wajib mengikuti pola ini (dari kiri ke kanan):

```
[Nama Game + Info Ronde/Giliran]   [Timer MM:SS] [Tombol Video] [Tombol Keluar?]
```

Contoh implementasi:
```tsx
<div className="flex items-center justify-between">
  <div>
    <p className="text-xs text-[#5C5470]">Nama Game</p>
    <p className="text-sm font-medium text-[#FFF5F8]">Info ronde / giliran</p>
  </div>
  <div className="flex items-center gap-2">
    <span className="font-mono text-sm text-[#9B93B0]">{fmt(timerSeconds)}</span>
    {/* Tombol video */}
    {/* Tombol keluar (opsional) */}
  </div>
</div>
```

---

## 4. Phase State Machine

Semua game memakai fase yang sama:

```ts
type PagePhase = "idle" | "setup" | "waiting" | "game" | "finished";
```

- `idle` — belum ada sesi; tampilkan form buat/join
- `setup` — konfigurasi sebelum buat sesi (opsional, bisa skip langsung ke waiting)
- `waiting` — sesi dibuat, menunggu partner join
- `game` — kedua player sudah join, game sedang berjalan
- `finished` — sesi selesai/expired/cancelled; tampilkan hasil

---

## 5. Countdown Timer

Gunakan hook `useCountdown` yang konsisten:

```ts
function useCountdown(targetISO: string | null, onExpire: () => void) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const calledRef = useRef(false);
  useEffect(() => {
    if (!targetISO) return;
    calledRef.current = false;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(targetISO).getTime() - Date.now()) / 1000));
      setSeconds(diff);
      if (diff === 0 && !calledRef.current) { calledRef.current = true; onExpire(); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO, onExpire]);
  return seconds;
}

function fmt(s: number | null) {
  if (s === null) return "--:--";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
```

Timer wajib dihitung dari `session.expires_at` (server timestamp), bukan `Date.now()` lokal, agar sinkron di semua device.

---

## 6. Sinkronisasi Timer Mini-Game

Untuk mini-game yang punya countdown sendiri (Dare Derby), gunakan `startedAt` dari server:

```ts
// Di applySession: catat server timestamp saat ronde baru dimulai
if (roundBaru && !adaSubmission) {
  roundStartedAtRef.current = new Date(s.updated_at).getTime();
}

// Di mini-game component: hitung dari server timestamp
function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000));
}
```

Interval countdown mini-game: **250ms** (bukan 1000ms) untuk akurasi display.

---

## 7. Realtime Subscription

Semua game subscribe ke perubahan `game_sessions` via Supabase Realtime:

```ts
const channel = supabase
  .channel(`<game-name>:${session.session_code}`)
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "game_sessions",
    filter: `session_code=eq.${session.session_code}`,
  }, (payload) => applySession(payload.new as SessionType))
  .subscribe();
```

Naming convention channel: `<game-name>:<session_code>` (misal: `tod:ABC123`, `snake-ladder:XYZ789`, `dare-derby:QWE456`).

---

## 8. API Endpoint Naming

Setiap game wajib punya endpoint berikut:

| Endpoint | Method | Keterangan |
|---|---|---|
| `/api/game/<game>/session/create` | POST | Buat sesi baru |
| `/api/game/<game>/session/join` | POST | Join sesi dengan kode |
| `/api/game/<game>/session/active` | GET | Cek sesi aktif untuk couple |
| `/api/game/<game>/session/[code]` | GET | Ambil data sesi by code |
| `/api/game/<game>/session/[code]/room` | GET | **Wajib** — Daily.co room URL |
| `/api/game/<game>/session/[code]/<action>` | POST | Aksi game-specific |

---

## 9. Warna & Style

Semua game pakai design system yang sama:

| Token | Value | Kegunaan |
|---|---|---|
| Background utama | `#111113` / `#0E0E12` | Page background |
| Card surface | `#18181C` | Input, card dalam |
| Border | `border-white/10` | Border default |
| Teks terang | `#FFF5F8` | Judul, angka penting |
| Teks sedang | `#9B93B0` | Label, deskripsi |
| Teks redup | `#5C5470` | Placeholder, info sekunder |
| Aksen pink | `#FF3D7F` / `#FF6B9D` | CTA utama, aksen game |
| Aksen indigo | `#818CF8` / `#A78BFA` | Aksen sekunder |
| Success | `#22C55E` (green-500) | Konfirmasi, menang |
| Error | `#EF4444` (red-500) | Error, kalah |

Rounded: `rounded-xl` (card), `rounded-2xl` (panel besar), `rounded-full` (badge/avatar).

---

## 10. Error Display

Semua error user-facing memakai pola ini:

```tsx
{error && (
  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
    {error}
  </div>
)}
```

---

## Checklist Game Baru

Sebelum merge game baru, pastikan:

- [ ] Waiting phase: tombol share kode via WhatsApp
- [ ] Video call terintegrasi (tombol toggle + `<VideoCall>` + endpoint `/room`)
- [ ] Layout pakai `max-w-md` (atau `max-w-[860px]` untuk board)
- [ ] Header game: nama game + info + timer + tombol video
- [ ] Phase machine: idle → setup? → waiting → game → finished
- [ ] Timer dihitung dari `session.expires_at` server
- [ ] Realtime subscription aktif saat `waiting` dan `game`
- [ ] Semua 5 endpoint API ada termasuk `/room`
- [ ] Warna dan style sesuai design system
- [ ] README di `docs/games/<nama-game>/README.md`
