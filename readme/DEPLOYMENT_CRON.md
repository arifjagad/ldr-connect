# Cron Jobs — Panduan Deployment & Migrasi

Dokumen ini menjelaskan bagaimana cron job LDR-Connect dikonfigurasi saat ini (Vercel Hobby/gratis), keterbatasannya, dan langkah konkret untuk mempercepat jadwalnya begitu project pindah ke Vercel Pro atau VPS.

---

## 1. Kondisi Saat Ini (Vercel Hobby)

Project ini deploy di **Vercel Hobby plan (gratis)**. Vercel membatasi cron job bawaan (`vercel.json`) pada plan ini ke **maksimal 1x per hari per cron entry**. Cron dengan jadwal lebih rapat (misal tiap 15 menit) akan **gagal saat deploy**.

Cron job yang aktif sekarang:

| Endpoint | Jadwal (UTC) | Kira-kira waktu WIB | Fungsi |
|---|---|---|---|
| `/api/cron/anniversary-reminders` | `0 1 * * *` | 08:00 | Push notif H-7/H-3/H-1 anniversary |
| `/api/cron/capsule-delivery` | `0 0 * * *` | 07:00 | Unlock time capsule yang sudah waktunya dibuka |
| `/api/cron/expire-topup` | `30 2 * * *` | 09:30 | Batalkan topup pending > 60 menit + tutup akses Midtrans + rollback voucher |
| `/api/cron/expire-sessions` | `0 3 * * *` | 10:00 | Expire + refund coin sesi game `waiting` yang ditelantarkan (partner tidak join) + expire sesi `playing` yang lolos dari timer client + cleanup Daily.co room |

Semua endpoint dilindungi header `Authorization: Bearer ${CRON_SECRET}` — Vercel otomatis mengirim header ini saat memicu cron terdaftar di `vercel.json`.

### Dampak nyata dari limitasi 1x/hari untuk `expire-topup`

Transaksi topup yang seharusnya expire di **60 menit** (sesuai desain di RPC `cancel_topup_transaction`) bisa "menggantung" sampai **~24 jam** sebelum benar-benar dibatalkan oleh cron ini. Selama menggantung:

- Kuota voucher (jika user memakai voucher diskon) belum dikembalikan.
- Transaksi itu ikut terhitung di rate limit "maksimal 3 pending topup / 15 menit" (`get_pending_topup_count`), jadi user yang sering gagal bayar bisa sementara terblokir membuat topup baru.
- Akses pembayaran (Snap page/VA) baru benar-benar ditutup setelah cron jalan.

Ini **bukan bug** — murni konsekuensi dari plan gratis Vercel. Kode sudah menangani race condition dengan benar (lihat `lib/coin/cancel-topup.ts`): kalau user ternyata bayar tepat sebelum expire diproses, sistem akan mengkredit coin sebagai sukses, bukan menggagalkannya.

### Dampak nyata dari limitasi 1x/hari untuk `expire-sessions`

Sesi game (`game_sessions`) berstatus `waiting` yang ditelantarkan (host membuat sesi tapi partner tidak pernah join, host juga tidak kembali membuat sesi baru atau klik batal) baru direfund maksimal ~24 jam setelah `expires_at` terlewati, bukan langsung. Selama menggantung, sesi ini akan menghalangi couple tersebut membuat sesi game baru (RPC `create_game_session` menolak dengan `ACTIVE_SESSION` selama masih ada baris `waiting`/`playing` yang belum expired) — **kecuali** salah satu pihak mencoba membuat sesi baru lagi, karena `create_game_session` sendiri juga auto-expire+refund sesi lama milik couple itu sebelum mengecek slot aktif (lihat migration 038). Jadi cron ini murni jaring pengaman untuk kasus di mana couple tidak pernah mencoba main lagi.

---

## 2. Migrasi Setelah Pindah dari Vercel Hobby

Ada dua jalur migrasi, pilih salah satu sesuai kondisi saat itu.

### Opsi A — Upgrade ke Vercel Pro

Vercel Pro mendukung jadwal cron lebih rapat (per menit jika perlu). Langkah:

1. Upgrade plan project di dashboard Vercel.
2. Ubah `vercel.json`, ganti jadwal `expire-topup` dan `expire-sessions` dari 1x/hari ke jadwal lebih rapat, misal tiap 15 menit:
   ```json
   {
     "path": "/api/cron/expire-topup",
     "schedule": "*/15 * * * *"
   },
   {
     "path": "/api/cron/expire-sessions",
     "schedule": "*/15 * * * *"
   }
   ```
3. Redeploy. Tidak ada perubahan kode lain yang diperlukan — kedua endpoint sudah generic dan aman dipanggil berulang kali (idempotent).
4. Anniversary-reminders dan capsule-delivery boleh dibiarkan 1x/hari (sifatnya memang harian), tidak perlu diubah.

### Opsi B — Pindah ke VPS (self-hosted)

Kalau project pindah ke VPS (misal deploy via Docker/PM2, bukan Vercel), Vercel Cron tidak lagi tersedia. Gunakan **system cron** (`crontab`) di VPS untuk memanggil endpoint yang sama via `curl`.

1. **Hapus/biarkan** blok `"crons"` di `vercel.json` — tidak berpengaruh jika app tidak lagi di-host di Vercel, tapi boleh dihapus untuk kebersihan.
2. Pastikan `CRON_SECRET` di environment variable VPS sama dengan yang dipakai app (`.env` di server).
3. Tambahkan entry di `crontab -e` pada server:

   ```cron
   # Expire topup pending — tiap 15 menit
   */15 * * * * curl -fsS -X GET https://domainkamu.com/api/cron/expire-topup \
     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/ldr-cron-expire-topup.log 2>&1

   # Expire game sessions yang ditelantarkan (+ refund) — tiap 15 menit
   */15 * * * * curl -fsS -X GET https://domainkamu.com/api/cron/expire-sessions \
     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/ldr-cron-expire-sessions.log 2>&1

   # Anniversary reminders — tiap hari jam 08:00 WIB (01:00 UTC)
   0 1 * * * curl -fsS -X GET https://domainkamu.com/api/cron/anniversary-reminders \
     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/ldr-cron-anniversary.log 2>&1

   # Capsule delivery — tiap hari jam 07:00 WIB (00:00 UTC)
   0 0 * * * curl -fsS -X GET https://domainkamu.com/api/cron/capsule-delivery \
     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/ldr-cron-capsule.log 2>&1
   ```

   Catatan: `$CRON_SECRET` di atas mengasumsikan variabel shell — kalau tidak diekspor ke shell cron, tulis langsung isinya (hindari commit nilai asli ke repo/dotfile publik).

4. Verifikasi manual sebelum mengandalkan cron:
   ```bash
   curl -i -X GET https://domainkamu.com/api/cron/expire-topup \
     -H "Authorization: Bearer <CRON_SECRET_ASLI>"
   ```
   Respons sukses berbentuk `{ "success": true, "message": "Expire topup selesai", "data": { "cancelled": N, "creditedAsPaid": N, "failed": N, "total": N } }`.

5. Setup log rotation untuk file log di atas (`logrotate`) supaya tidak membengkak tanpa batas.

### Opsi C — Sudah punya GitHub Actions (alternatif tanpa VPS/Pro)

Kalau belum pindah VPS/Pro tapi ingin jadwal lebih rapat sekarang, project ini sudah ada di GitHub — bisa pakai **GitHub Actions scheduled workflow** (gratis) sebagai pemicu tambahan tanpa mengubah hosting:

```yaml
# .github/workflows/expire-topup-cron.yml
name: Expire Pending Topup
on:
  schedule:
    - cron: "*/15 * * * *"
  workflow_dispatch: {}

jobs:
  call-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Call expire-topup endpoint
        run: |
          curl -fsS -X GET "${{ secrets.APP_URL }}/api/cron/expire-topup" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Simpan `APP_URL` dan `CRON_SECRET` sebagai **GitHub Actions secrets** (Settings → Secrets and variables → Actions). Vercel Hobby tidak melarang endpoint-nya dipanggil dari luar — yang dibatasi hanya cron **native** Vercel sendiri. Cron bawaan Vercel (`vercel.json`, 1x/hari) boleh tetap dibiarkan aktif sebagai jaring pengaman kedua, karena endpoint aman dipanggil berulang (idempotent).

---

## 3. Menambah Cron Job Baru

Kalau di masa depan perlu menambah cron lain, ikuti pola yang sudah ada:

1. Buat route di `app/api/cron/<nama>/route.ts` dengan method `GET`.
2. Auth wajib di baris pertama handler:
   ```ts
   const authHeader = req.headers.get("authorization");
   const cronSecret = process.env.CRON_SECRET;
   if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```
3. Gunakan `createServiceClient()` (bypass RLS) untuk operasi lintas-user.
4. Kalau loop banyak item, bungkus per-item dengan `try/catch` supaya satu item gagal tidak menggagalkan seluruh batch (lihat `app/api/cron/expire-topup/route.ts` sebagai contoh).
5. Daftarkan di `vercel.json` — ingat batas 1x/hari di Hobby plan.
6. Tambah test auth mengikuti pola `tests/cron-security.test.ts` / `tests/expire-topup-cron.test.ts`.
