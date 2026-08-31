# 📋 Shared Wishlist — Feature Design

## Ringkasan

Fitur bucket list bersama untuk pasangan LDR. Tempat menyimpan hal-hal yang ingin dilakukan bersama — dari yang bisa dilakukan hari ini (virtual) sampai impian jangka panjang.

Berbeda dengan chat WA: wishlist ini **tersimpan permanen**, punya **progress visual**, dan setiap pencapaian jadi **momen yang dirayakan** bersama.

---

## Kategori Item

| Kategori | Emoji | Contoh |
|----------|-------|--------|
| `virtual` | 🎮 | Nonton bareng, masak sambil video call, game online |
| `offline` | ✈️ | Makan di restoran, foto di spot tertentu, staycation |
| `dream` | 🌙 | Tinggal satu kota, liburan ke luar negeri, adopsi hewan |
| `gift` | 🎁 | Kirim hadiah fisik, surprise delivery |
| `other` | 📌 | Lain-lain |

---

## Database — 1 Tabel

```sql
CREATE TABLE public.wishlists (
  id           BIGSERIAL    PRIMARY KEY,
  couple_id    UUID         NOT NULL,
  created_by   UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  category     VARCHAR(10)  NOT NULL DEFAULT 'other'
                 CHECK (category IN ('virtual', 'offline', 'dream', 'gift', 'other')),

  is_done      BOOLEAN      NOT NULL DEFAULT false,
  done_by      UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  done_at      TIMESTAMPTZ,
  done_note    TEXT,

  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

### Kenapa cukup 1 tabel?
- Partner hanya 2 orang → tidak perlu tabel reaksi/komentar terpisah
- `done_by` sudah cukup untuk tahu siapa yang menyelesaikan
- `done_note` untuk catatan singkat saat item selesai

---

## Contoh Data Real

**Arif menambahkan:**
```
id=1 | "Nonton Interstellar bareng via Netflix Party" | virtual
id=2 | "Makan di Sushi Tei saat ketemu"              | offline
id=3 | "Road trip ke Bromo bareng"                   | dream
```

**Hani menambahkan:**
```
id=4 | "Masak mie ayam yang sama sambil video call"  | virtual
id=5 | "Beliin Arif hoodie cokelat"                  | gift
```

**Arif mencentang id=1 (sudah Netflix Party-an):**
```
is_done=true | done_by=arif | done_note="Hani nangis pas ending Interstellar 😂"
```
→ Hani dapat push notif: *"Arif menyelesaikan: Nonton Interstellar bareng 🎉"*

---

## Mockup UI

### Feed Utama
```
┌─────────────────────────────────────────┐
│  📋 Wishlist Kita           1/5 selesai │
│  ██░░░░░░░░░░░░░░  20%                  │
├─────────────────────────────────────────┤
│  [Semua] [🎮 Virtual] [✈️ Offline] [🌙 Impian]  │
├─────────────────────────────────────────┤
│  ✅ Nonton Interstellar bareng    🎮    │
│     Arif · "Hani nangis pas ending 😂" │
├─────────────────────────────────────────┤
│  ⬜ Makan di Sushi Tei            ✈️   │
│     Arif · menunggu ketemu             │
├─────────────────────────────────────────┤
│  ⬜ Masak mie ayam via video call  🎮  │
│     Hani · bisa weekend ini!           │
├─────────────────────────────────────────┤
│  ⬜ Beliin Arif hoodie cokelat    🎁   │
│     Hani · (surprise)                  │
├─────────────────────────────────────────┤
│  ⬜ Road trip ke Bromo            🌙   │
│     Arif · impian bersama              │
└─────────────────────────────────────────┘
                         [+ Tambah Wishlist]
```

### Modal Saat Centang Item
```
┌──────────────────────────────┐
│  🎉 Yeay, sudah kesampaian! │
│                              │
│  Tambah catatan? (opsional)  │
│  ┌────────────────────────┐  │
│  │ "Seru banget!"         │  │
│  └────────────────────────┘  │
│                              │
│  [Batal]   [Tandai Selesai]  │
└──────────────────────────────┘
```

---

## API Routes

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/wishlist` | Ambil semua wishlist couple (filter by category, done) |
| `POST` | `/api/wishlist` | Tambah item baru |
| `PATCH` | `/api/wishlist/[id]` | Edit title / desc / category |
| `PATCH` | `/api/wishlist/[id]/done` | Tandai selesai + simpan note |
| `DELETE` | `/api/wishlist/[id]` | Hapus item (hanya created_by) |

---

## Push Notification

| Trigger | Penerima | Pesan |
|---------|----------|-------|
| Partner tambah item baru | Kamu | *"Hani menambahkan wishlist baru: Masak mie ayam 📋"* |
| Partner tandai item selesai | Kamu | *"Arif menyelesaikan: Nonton Interstellar 🎉"* |

> Tidak ada notif saat edit atau hapus item sendiri.

---

## RLS Policy

| Aksi | Aturan |
|------|--------|
| SELECT | `couple_id` harus cocok dengan couple user yang login |
| INSERT | `couple_id` otomatis di-set = `LEAST(user.id, partner.id)` |
| UPDATE / DELETE | Hanya `created_by` yang bisa ubah/hapus |
| PATCH done | Kedua partner boleh centang (yang pertama ketemu bisa langsung centang) |

---

## Estimasi Pengerjaan

| Bagian | Estimasi |
|--------|----------|
| Migration SQL | 15 menit |
| API Routes (5 endpoint) | 1–2 jam |
| Halaman UI `/dashboard/wishlist` | 2–3 jam |
| Push notification integration | 30 menit |
| **Total** | **~1 hari kerja** |

---

## Cocok atau Tidak?

### ✅ Cocok jika:
- Suka merencanakan hal-hal bersama secara terstruktur
- Ingin ada "arsip" pencapaian hubungan yang tidak tenggelam di chat
- Mau ada alasan buka app setiap hari selain main game

### ❌ Tidak cocok jika:
- Sudah punya sistem serupa di Notion / Google Keep
- Lebih suka spontan dan tidak suka format "to-do list" dalam hubungan
- Tidak ada rencana ketemu dalam waktu dekat (wishlist offline jadi stale)
