# 🔐 OWASP Secure Coding Practices — Checklist

> Berdasarkan [OWASP Secure Coding Practices Quick Reference Guide](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)
> 
> ⚠️ Item bertanda `[RACE]` kritis untuk **race condition** | Item bertanda `[PAY]` kritis untuk **payment gateway**
>
> **Status Audit:**
> - `[x]` = Sudah diimplementasikan dengan benar
> - `[-]` = Tidak bisa dicek (perlu verifikasi manual / ditangani framework/infrastruktur)
> - `[(x)]` = **BERMASALAH — perlu diperbaiki**

---

## 1. Input Validation

- [x] Validasi semua input dilakukan di sisi server (bukan client-side)
- [-] Identifikasi semua sumber data dan klasifikasikan mana yang trusted/untrusted
- [x] Validasi semua data dari sumber untrusted (database, file stream, dll)
- [-] Gunakan satu centralized routine untuk validasi input di seluruh aplikasi
- [-] Tentukan character set (misal UTF-8) untuk semua sumber input
- [-] Encode input ke character set yang seragam sebelum divalidasi
- [x] Semua kegagalan validasi harus menghasilkan penolakan input
- [-] Jika sistem mendukung UTF-8 extended, validasi setelah UTF-8 decoding selesai
- [x] Validasi semua data yang disediakan client sebelum diproses
- [-] Verifikasi header protokol (request & response) hanya mengandung ASCII
- [-] Validasi data dari redirect
- [x] Gunakan "allow list" bukan "deny list" untuk validasi tipe data
- [x] Validasi range data `[PAY]`
- [-] Validasi panjang data *(minimal — DB column limit jadi safety net, tapi tidak ada max length eksplisit di kode)*
- [-] Jika input berbahaya terpaksa diizinkan, implementasikan kontrol tambahan
- [-] Gunakan canonicalization untuk mencegah obfuscation attacks

---

## 2. Output Encoding

- [x] Semua output encoding dilakukan di sisi server
- [x] Gunakan satu routine standar yang sudah teruji untuk setiap jenis encoding *(NextResponse.json)*
- [-] Tentukan character set (misal UTF-8) untuk semua output
- [x] Encode secara kontekstual semua data dari sumber untrusted yang dikembalikan ke client
- [-] Pastikan output encoding aman untuk semua target sistem
- [x] Sanitasi output data untrusted untuk query SQL, XML, dan LDAP *(Supabase SDK parameterized)*
- [x] Sanitasi output data untrusted untuk perintah OS *(tidak ada OS command)*

---

## 3. Authentication & Password Management

- [x] Wajibkan autentikasi untuk semua halaman/resource kecuali yang memang public
- [x] Semua kontrol autentikasi dijalankan di trusted system (server-side)
- [x] Gunakan layanan autentikasi standar yang sudah teruji jika memungkinkan *(Supabase Auth)*
- [-] Gunakan implementasi terpusat untuk semua kontrol autentikasi *(tidak ada middleware.ts — setiap route melakukan auth check sendiri)*
- [-] Pisahkan logika autentikasi dari resource yang diminta *(tidak ada middleware.ts)*
- [x] Semua kontrol autentikasi harus fail securely
- [-] Semua fungsi admin/akun harus minimal sama amannya dengan mekanisme autentikasi utama
- [x] Gunakan cryptographically strong one-way salted hash untuk menyimpan credential *(Supabase handles this)*
- [x] Password hashing harus dilakukan di server-side *(Supabase handles this)*
- [x] Validasi data autentikasi hanya setelah semua input selesai dimasukkan
- [x] Respon gagal autentikasi tidak boleh mengindikasikan bagian mana yang salah
- [x] Gunakan autentikasi untuk koneksi ke sistem eksternal yang menyangkut data sensitif
- [x] Credential untuk sistem eksternal disimpan di secure store *(.env.local, tidak di kode)*
- [x] Gunakan hanya HTTP POST untuk mengirimkan credential `[PAY]`
- [x] Kirim password non-temporary hanya melalui koneksi terenkripsi
- [-] Terapkan kompleksitas password sesuai kebijakan *(Supabase default)*
- [-] Terapkan panjang minimum password sesuai kebijakan *(Supabase default)*
- [-] Input password harus disembunyikan di layar user *(frontend — perlu verifikasi manual)*
- [(x)] Nonaktifkan akun setelah sejumlah percobaan login gagal `[PAY]` ← **tidak dikonfigurasi, brute force tidak diblokir**
- [-] Reset & perubahan password memerlukan kontrol setara dengan pembuatan akun *(Supabase handles)*
- [-] Jika reset via email, kirim hanya ke alamat terdaftar dengan link/password sementara *(Supabase handles)*
- [-] Password/link sementara harus memiliki waktu kedaluwarsa singkat `[PAY]` *(Supabase default)*
- [-] Paksa perubahan password sementara pada penggunaan pertama
- [-] Notifikasi user ketika terjadi reset password *(Supabase handles)*
- [-] Cegah penggunaan ulang password *(Supabase default)*
- [-] Nonaktifkan fitur "remember me" untuk field password *(frontend — perlu verifikasi manual)*
- [-] Tampilkan informasi penggunaan akun terakhir saat login berikutnya *(tidak diimplementasikan)*
- [-] Implementasikan monitoring untuk mendeteksi serangan terhadap multiple akun *(tidak diimplementasikan)*
- [-] Ubah semua password/user ID default dari vendor atau nonaktifkan akun tersebut *(Supabase managed)*
- [(x)] Re-autentikasi user sebelum operasi kritis `[PAY]` `[RACE]` ← **tidak ada `reauthenticate()` sebelum topup**
- [(x)] Gunakan Multi-Factor Authentication untuk akun bertransaksi sensitif `[PAY]` ← **tidak diimplementasikan**
- [-] Jika menggunakan kode pihak ketiga untuk autentikasi, periksa tidak ada kode jahat

---

## 4. Session Management

- [x] Gunakan session management bawaan server/framework *(Supabase SSR)*
- [x] Pembuatan session identifier selalu dilakukan di server-side *(Supabase)*
- [x] Gunakan algoritma yang menghasilkan session ID yang cukup acak *(Supabase JWT)*
- [x] Set domain dan path cookie session ke nilai yang sesuai dan terbatas *(Supabase SSR)*
- [x] Logout harus sepenuhnya mengakhiri session/koneksi
- [x] Fitur logout tersedia di semua halaman yang dilindungi
- [(x)] Tetapkan inactivity timeout session sesingkat mungkin `[PAY]` ← **Supabase default 1 jam, tidak dikonfigurasi lebih pendek**
- [(x)] Larang persistent login dan terapkan terminasi session berkala `[PAY]` ← **Supabase refresh token mengaktifkan persistent login**
- [x] Jika ada session sebelum login, tutup dan buat session baru setelah login berhasil *(Supabase handles)*
- [-] Generate session ID baru setiap re-autentikasi `[PAY]` *(Supabase handles)*
- [(x)] Jangan izinkan login concurrent dengan user ID yang sama `[PAY]` `[RACE]` ← **tidak ada proteksi multiple session, Supabase mengizinkan ini**
- [x] Jangan tampilkan session identifier di URL, pesan error, atau log
- [-] Terapkan akses kontrol yang tepat untuk data session server-side *(Supabase handles)*
- [-] Generate session ID baru dan nonaktifkan yang lama secara berkala *(Supabase handles)*
- [-] Generate session ID baru jika koneksi berubah dari HTTP ke HTTPS *(enforced HTTPS, tidak relevan)*
- [x] Gunakan HTTPS secara konsisten, jangan bergantian dengan HTTP *(Netlify enforces HTTPS)*
- [x] Gunakan token acak per-session untuk operasi sensitif server-side `[PAY]` *(Midtrans order ID unik per transaksi)*
- [(x)] Untuk operasi sangat kritis, gunakan token acak per-request (bukan per-session) `[PAY]` `[RACE]` ← **Snake game state tidak menggunakan per-roll token untuk mencegah replay**
- [x] Set atribut "secure" pada cookie yang ditransmisikan melalui TLS *(Supabase SSR)*
- [x] Set atribut HttpOnly pada cookie kecuali memang perlu diakses client-side script *(Supabase SSR)*

---

## 5. Access Control

- [x] Gunakan objek trusted system (server-side) untuk keputusan otorisasi
- [(x)] Gunakan satu komponen site-wide untuk memeriksa otorisasi ← **tidak ada `middleware.ts` — setiap route melakukan auth check sendiri, rentan jika route baru lupa**
- [x] Kontrol akses harus fail securely
- [-] Tolak semua akses jika aplikasi tidak bisa membaca konfigurasi keamanan
- [x] Terapkan kontrol otorisasi pada setiap request `[PAY]`
- [x] Pisahkan logika privileged dari kode aplikasi lainnya *(service role key)*
- [x] Batasi akses ke file/resource hanya untuk user yang berwenang *(RLS)*
- [x] Batasi akses ke URL yang dilindungi hanya untuk user yang berwenang
- [x] Batasi akses ke fungsi yang dilindungi hanya untuk user yang berwenang
- [x] Batasi referensi objek langsung hanya untuk user yang berwenang *(UUID + RLS)*
- [x] Batasi akses ke layanan hanya untuk user yang berwenang
- [x] Batasi akses ke data aplikasi hanya untuk user yang berwenang *(RLS)*
- [x] Batasi akses ke atribut user, data, dan informasi kebijakan akses kontrol
- [x] Batasi akses ke konfigurasi keamanan hanya untuk user yang berwenang
- [x] Implementasi server-side dan presentasi layer harus konsisten
- [(x)] Jika state data disimpan di client, gunakan enkripsi + integrity check di server `[RACE]` ← **Zustand client state tidak diverifikasi ulang ke server sebelum digunakan**
- [x] Terapkan alur logika aplikasi sesuai aturan bisnis `[PAY]` `[RACE]` *(via RPC atomic)*
- [(x)] **Batasi jumlah transaksi yang bisa dilakukan satu user/device dalam periode tertentu** `[PAY]` `[RACE]` ← **hanya topup yang di-rate-limit (3/15 menit), game session create/join tidak ada rate limiting**
- [x] Jangan gunakan header "referer" sebagai satu-satunya pengecekan otorisasi
- [-] Untuk session panjang, validasi ulang otorisasi user secara berkala
- [-] Implementasikan audit akun dan nonaktifkan akun yang tidak digunakan *(tabel admin_activity_logs ada, tapi penggunaannya belum terverifikasi)*
- [-] Aplikasi harus mendukung penonaktifan akun dan terminasi session
- [x] Service account harus memiliki privilege seminimal mungkin

---

## 6. Cryptographic Practices

- [x] Semua fungsi kriptografi diimplementasikan di trusted system *(server-side)*
- [x] Lindungi secrets dari akses tidak sah *(env vars, tidak di kode)*
- [-] Modul kriptografi harus fail securely
- [x] Semua angka acak, nama file acak, GUID, dan string acak menggunakan RNG yang disetujui modul kriptografi *(✅ PAY-04 fixed: `crypto.randomBytes(4)` di `topup/route.ts`)*
- [-] Modul kriptografi harus sesuai standar FIPS 140-2 atau setara *(Supabase/Netlify managed)*
- [-] Tetapkan kebijakan dan proses pengelolaan kunci kriptografi `[PAY]`

---

## 7. Error Handling & Logging

- [x] Jangan tampilkan informasi sensitif di response error (detail sistem, session ID, info akun)
- [x] Gunakan error handler yang tidak menampilkan debugging/stack trace
- [-] Gunakan pesan error generik dan halaman error kustom *(perlu verifikasi halaman error Next.js)*
- [-] Aplikasi harus menangani error sendiri, bukan bergantung pada konfigurasi server
- [-] Bebaskan memori yang dialokasikan saat kondisi error terjadi *(JavaScript GC)*
- [x] Logika error handling untuk kontrol keamanan harus deny by default
- [x] Semua kontrol logging diimplementasikan di trusted system *(server-side console)*
- [-] Logging harus mendukung pencatatan sukses dan gagal untuk event keamanan *(partial)*
- [-] Pastikan log mengandung data event penting
- [-] Batasi akses log hanya untuk individu yang berwenang *(Netlify/server managed)*
- [-] Gunakan satu routine terpusat untuk semua operasi logging *(belum ada centralized logger)*
- [x] Jangan simpan informasi sensitif di log (password, session ID, dll) *(✅ PAY-03 fixed: webhook hanya log `order_id`, `transaction_status`, `fraud_status`)*
- [-] Log semua kegagalan validasi input *(implicit via HTTP error codes)*
- [(x)] **Log semua percobaan autentikasi, terutama yang gagal** `[PAY]` ← **tidak ada logging untuk failed login attempts** *(Supabase Auth menangani ini di level infra; aplikasi tidak bisa intercept)*
- [x] **Log semua kegagalan akses kontrol** `[PAY]` *(✅ LOG-01 fixed: `security:payment_ownership_violation` dicatat via `lib/security-logger.ts`)*
- [x] **Log semua event tampering, termasuk perubahan state data yang tidak terduga** `[RACE]` `[PAY]` *(✅ LOG-01 fixed: `security:webhook_sig_fail` dicatat via `lib/security-logger.ts`)*
- [(x)] Log percobaan koneksi dengan token session tidak valid/kedaluwarsa `[PAY]` ← **tidak diimplementasikan** *(Supabase Auth menangani di level infra)*
- [-] Log semua exception sistem *(partial — hanya beberapa route yang log error)*
- [-] Log semua fungsi administratif *(belum terverifikasi)*
- [-] Log semua kegagalan koneksi TLS backend *(tidak diimplementasikan)*
- [-] Log semua kegagalan modul kriptografi *(tidak diimplementasikan)*
- [-] Gunakan hash kriptografi untuk memvalidasi integritas log entry

---

## 8. Data Protection

- [x] Implementasikan least privilege *(RLS + service role hanya untuk writes)*
- [-] Lindungi semua salinan cache atau temporary dari data sensitif di server *(Supabase managed)*
- [x] Enkripsi informasi sensitif yang disimpan, seperti data verifikasi autentikasi `[PAY]` *(Supabase at-rest encryption)*
- [x] Lindungi source code server-side dari download oleh user *(Next.js server routes)*
- [x] Jangan simpan password, connection string, atau info sensitif dalam cleartext di client
- [x] Hapus komentar di kode production yang dapat mengungkap informasi backend
- [-] Hapus dokumentasi aplikasi/sistem yang tidak perlu
- [x] **Jangan masukkan informasi sensitif ke parameter HTTP GET** `[PAY]` *(semua payment via POST)*
- [-] Nonaktifkan autocomplete pada form yang mengandung informasi sensitif *(frontend — perlu verifikasi manual)*
- [x] Nonaktifkan client-side caching di halaman yang mengandung informasi sensitif `[PAY]` *(✅ PAY-05 fixed: `Cache-Control: no-store` di `/api/coin/*` dan `/topup/*`)*
- [-] Aplikasi harus mendukung penghapusan data sensitif saat tidak lagi diperlukan
- [x] Terapkan akses kontrol untuk data sensitif yang disimpan di server *(RLS)*

---

## 9. Communication Security

- [x] Implementasikan enkripsi untuk semua transmisi informasi sensitif (gunakan TLS) `[PAY]` *(Netlify HTTPS)*
- [-] Sertifikat TLS harus valid, nama domain benar, belum expired, dan terinstall dengan benar *(Netlify managed)*
- [x] Koneksi TLS yang gagal tidak boleh fallback ke koneksi tidak aman `[PAY]`
- [x] Gunakan TLS untuk semua konten yang memerlukan authenticated access
- [x] Gunakan TLS untuk koneksi ke sistem eksternal yang menyangkut data sensitif `[PAY]` *(semua API eksternal via HTTPS)*
- [x] Gunakan satu implementasi TLS standar yang dikonfigurasi dengan benar
- [-] Tentukan character encoding untuk semua koneksi
- [x] Filter parameter sensitif dari HTTP referer saat linking ke situs eksternal *(Referrer-Policy: strict-origin-when-cross-origin)*

---

## 10. System Configuration

- [-] Pastikan server, framework, dan komponen sistem berjalan pada versi terbaru yang disetujui *(perlu audit `package.json` secara berkala)*
- [-] Pastikan semua patch telah diterapkan
- [x] Nonaktifkan directory listing *(Next.js App Router)*
- [-] Batasi privilege web server, process, dan service account seminimal mungkin *(Netlify managed)*
- [x] Saat exception terjadi, fail securely
- [x] Hapus semua fungsionalitas dan file yang tidak perlu *(✅ DEP-01 fixed: migration 009 drop fungsi deprecated `create_snake_session`, `join_snake_session`, `get_active_snake_session_for_couple`)*
- [x] Hapus test code atau fungsionalitas yang tidak ditujukan untuk production sebelum deployment *(✅ DEP-02 fixed: `.env.local.example` diupdate dengan variabel Supabase yang benar)*
- [-] Cegah pengungkapan struktur direktori di file robots.txt
- [x] Tentukan HTTP method (GET/POST) yang didukung aplikasi
- [-] Nonaktifkan HTTP method yang tidak diperlukan *(Next.js App Router handles this)*
- [x] Hapus informasi tidak perlu dari HTTP response header (OS, versi web server, framework) *(✅ SEC-01 fixed: nonce-based CSP via `middleware.ts` — `'unsafe-inline'` dihapus dari `script-src`) (✅ SEC-02 fixed: HSTS header sudah ditambahkan)*
- [-] Konfigurasi keamanan harus bisa dioutput dalam format human-readable untuk audit
- [-] Implementasikan sistem manajemen aset
- [x] Isolasi environment development dari production network *(.env.local)*
- [x] Implementasikan sistem kontrol perubahan software *(git)*

---

## 11. Database Security

- [x] Gunakan strongly typed parameterized query (prepared statements) `[PAY]` *(Supabase SDK + RPC)*
- [x] Gunakan input validation dan output encoding untuk meta characters di query database
- [x] Pastikan variabel strongly typed *(TypeScript)*
- [x] Gunakan level privilege terendah saat mengakses database `[PAY]` *(RLS + service role hanya untuk bisnis logik)*
- [x] Gunakan credential yang aman untuk akses database
- [x] **Connection string tidak boleh hard-coded dalam aplikasi; simpan terenkripsi di konfigurasi terpisah** `[PAY]` *(env vars)*
- [x] Gunakan stored procedure untuk abstraksi akses data jika memungkinkan *(RPC functions)*
- [x] Tutup koneksi database segera setelah selesai digunakan `[RACE]` *(Supabase connection pooling)*
- [-] Ubah atau hapus semua password administratif database default *(Supabase managed)*
- [-] Nonaktifkan semua fungsionalitas database yang tidak diperlukan *(Supabase managed)*
- [-] Hapus konten default vendor yang tidak perlu *(Supabase managed)*
- [-] Nonaktifkan akun default yang tidak diperlukan *(Supabase managed)*
- [x] Gunakan credential berbeda untuk setiap tingkat kepercayaan akses database *(user client vs service role client)*

---

## 12. File Management

- [-] Jangan teruskan data user langsung ke fungsi dynamic include *(tidak ada file include)*
- [-] Wajibkan autentikasi sebelum mengizinkan upload file *(tidak ada fitur upload)*
- [-] Batasi jenis file yang bisa diupload sesuai kebutuhan bisnis *(tidak ada fitur upload)*
- [-] Validasi tipe file upload melalui file header, bukan hanya ekstensi *(tidak ada fitur upload)*
- [-] Jangan simpan file upload di direktori yang sama dengan konteks web aplikasi *(tidak ada fitur upload)*
- [-] Cegah atau batasi upload file yang bisa diinterpretasikan oleh web server *(tidak ada fitur upload)*
- [-] Nonaktifkan eksekusi di direktori upload file *(tidak ada fitur upload)*
- [-] Gunakan allow-list untuk nama dan tipe file yang diizinkan saat mereferensikan file *(tidak ada fitur upload)*
- [-] Jangan teruskan data user ke redirect dinamis
- [x] Jangan gunakan path direktori/file langsung dari user; gunakan index ke daftar path yang sudah ditentukan
- [x] Jangan pernah kirim path file absolut ke client
- [-] Pastikan file dan resource aplikasi bersifat read-only *(Netlify managed)*
- [-] Scan file yang diupload user untuk virus dan malware *(tidak ada fitur upload)*

---

## 13. Memory Management

- [x] Gunakan kontrol input dan output untuk data untrusted
- [-] Periksa bahwa buffer sesuai ukuran yang ditentukan *(JavaScript handles this)*
- [-] Pastikan NULL termination ditangani dengan benar *(tidak aplikabel — JavaScript)*
- [-] Periksa batas buffer dalam loop untuk mencegah overflow *(tidak aplikabel — JavaScript)*
- [-] Truncate semua string input ke panjang yang wajar sebelum diteruskan ke fungsi lain *(minimal)*
- [-] Tutup resource secara eksplisit, jangan bergantung pada garbage collection *(Supabase SDK managed)*
- [-] Hindari penggunaan fungsi yang diketahui memiliki kerentanan
- [-] Bebaskan memori yang dialokasikan setelah fungsi selesai dan di semua exit point *(JavaScript GC)*
- [-] Timpa informasi sensitif yang tersimpan di memori di semua exit point *(tidak aplikabel — JavaScript)*

---

## 14. General Coding Practices

- [x] Gunakan managed code yang sudah teruji untuk tugas umum *(Next.js, Supabase)*
- [x] Gunakan API bawaan untuk tugas OS; jangan izinkan aplikasi mengeluarkan perintah langsung ke OS
- [-] Gunakan checksum atau hash untuk memverifikasi integritas library, executable, dan file konfigurasi
- [x] **Gunakan locking untuk mencegah multiple request simultan, atau gunakan mekanisme sinkronisasi untuk mencegah race condition** `[RACE]` `[PAY]` *(✅ RC-01 fixed: `roll_snake_dice` + `confirm_snake_challenge` RPC dengan `SELECT FOR UPDATE` — migration 008)*
- [x] **Lindungi shared variable dan resource dari concurrent access yang tidak tepat** `[RACE]` `[PAY]` *(✅ RC-02 fixed: `cancel_game_session` RPC atomic — migration 008)*
- [x] Inisialisasi semua variabel dan data store secara eksplisit *(TypeScript)*
- [-] Jika aplikasi harus berjalan dengan elevated privilege, naikkan privilege selambat mungkin dan turunkan sesegera mungkin
- [x] Hindari calculation error dengan memahami representasi tipe data di bahasa pemrograman
- [x] Jangan teruskan data user ke fungsi eksekusi dinamis
- [x] Batasi user dari membuat kode baru atau mengubah kode yang ada
- [-] Review semua aplikasi sekunder, kode pihak ketiga, dan library
- [x] Implementasikan safe updating menggunakan encrypted channel *(Netlify CI/CD)*

---

## 🚨 Ringkasan Item Kritis: Race Condition & Payment Gateway

### ⚡ Race Condition `[RACE]`

| # | Item |
|---|------|
| 1 | Gunakan locking/mekanisme sinkronisasi untuk mencegah multiple request simultan |
| 2 | Lindungi shared variable dan resource dari concurrent access |
| 3 | Jangan izinkan login concurrent dengan user ID yang sama |
| 4 | Gunakan token acak per-request (bukan per-session) untuk operasi sangat kritis |
| 5 | Terapkan alur logika aplikasi sesuai aturan bisnis (jangan bisa di-bypass) |
| 6 | Jika state data disimpan di client, gunakan enkripsi + integrity check di server |
| 7 | Log semua event tampering dan perubahan state data yang tidak terduga |
| 8 | Tutup koneksi database segera setelah digunakan |
| 9 | Batasi jumlah transaksi per user/device dalam periode waktu tertentu |

### 💳 Payment Gateway `[PAY]`

| # | Item |
|---|------|
| 1 | Gunakan HTTPS/TLS untuk semua komunikasi payment |
| 2 | Koneksi TLS gagal tidak boleh fallback ke koneksi tidak aman |
| 3 | Re-autentikasi user sebelum operasi pembayaran kritis |
| 4 | Gunakan MFA untuk akun transaksi bernilai tinggi |
| 5 | Token/link sementara harus kedaluwarsa dalam waktu singkat |
| 6 | Connection string database disimpan terenkripsi, tidak hard-coded |
| 7 | Jangan masukkan data payment ke parameter HTTP GET |
| 8 | Nonaktifkan caching di halaman yang mengandung data payment |
| 9 | Log semua percobaan autentikasi yang gagal |
| 10 | Log semua kegagalan akses kontrol |
| 11 | Terapkan kontrol otorisasi pada setiap request transaksi |
| 12 | Batasi jumlah transaksi per user dalam periode waktu tertentu |
| 13 | Gunakan prepared statement untuk semua query database terkait payment |
| 14 | Generate session ID baru setiap re-autentikasi |
| 15 | Enkripsi data payment yang disimpan di server |

---

## ✅ Temuan yang Sudah Diperbaiki + 🔴 Yang Masih Perlu Perbaikan

### RACE CONDITION

---

#### ✅ RC-01 `[RACE]` Snake game state — **FIXED**
Logika roll + confirm dipindahkan ke stored procedure `roll_snake_dice` + `confirm_snake_challenge` (migration 008) dengan `SELECT ... FOR UPDATE`.  
**Routes diperbarui:** `roll/route.ts`, `confirm/route.ts` — sekarang hanya memanggil RPC.

---

#### ✅ RC-02 `[RACE]` Cancel + refund tidak atomik — **FIXED**
Seluruh logika cancel+refund dipindahkan ke stored procedure `cancel_game_session` (migration 008). `SELECT ... FOR UPDATE` pada session memastikan hanya satu request yang bisa memproses refund.  
**Route diperbarui:** `cancel/route.ts` — sekarang hanya memanggil RPC.

---

### PAYMENT GATEWAY

---

#### ✅ PAY-01 `[PAY]` `verify` tidak cek `fraud_status` — **FIXED**
`verify/route.ts` sekarang memeriksa `fraud_status === "accept"` untuk `capture`, konsisten dengan webhook.

---

#### ✅ PAY-02 `[PAY]` `verify` tidak verifikasi kepemilikan — **FIXED**
`verify/route.ts` sekarang memvalidasi `coin_transactions.user_id === auth.uid()` sebelum memanggil RPC.

---

#### ✅ PAY-03 `[PAY]` Webhook log payload sensitif — **FIXED**
`webhook/route.ts` sekarang hanya log `order_id`, `transaction_status`, `fraud_status`.

---

#### ✅ PAY-04 `[PAY]` `Math.random()` untuk order ID — **FIXED**
`topup/route.ts` sekarang menggunakan `crypto.randomBytes(4).toString("hex")`.

---

#### ✅ PAY-05 `[PAY]` Tidak ada `Cache-Control` untuk halaman payment — **FIXED**
`next.config.ts` sekarang menambahkan `Cache-Control: no-store` untuk `/api/coin/*` dan `/topup/*`.

---

### SECURITY HEADERS

---

#### ✅ SEC-01 CSP nonce-based — **FIXED**
`middleware.ts` sekarang membuat nonce unik per request dan menyetel CSP header dengan `'nonce-{value}'` + `'strict-dynamic'`. `'unsafe-inline'` dihapus dari `script-src`.  
`next.config.ts` tidak lagi menyetel CSP statis — middleware menanganinya per-request.  
`'unsafe-eval'` dipertahankan karena Daily.co Web SDK memerlukannya (documented requirement).

---

#### ✅ SEC-02 HSTS header — **FIXED**
`next.config.ts` sekarang menyertakan `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

---

### LOGGING & AUDIT

---

#### ✅ LOG-01 Centralized security event logging — **FIXED**
`lib/security-logger.ts` dibuat sebagai fire-and-forget helper yang menulis ke `admin_activity_logs`.  
Event yang dicatat:
- `security:webhook_sig_fail` — Midtrans webhook dengan signature tidak valid (`webhook/route.ts`)
- `security:payment_ownership_violation` — user mencoba verify payment milik orang lain (`verify/route.ts`)

---

### KODE DEPRECATED

---

#### ✅ DEP-01 Fungsi deprecated di migration — **FIXED**
Migration 009 mendrop `create_snake_session`, `join_snake_session`, `get_active_snake_session_for_couple`.

---

#### ✅ DEP-02 `.env.local.example` lama — **FIXED**
File diperbarui dengan variabel Supabase, Midtrans, Daily.co yang benar.

---

## 📊 Ringkasan Audit

| Kategori | `[x]` OK | `[-]` Manual | `[(x)]` Masalah |
|----------|----------|--------------|----------------|
| Input Validation | 5 | 11 | 0 |
| Output Encoding | 5 | 2 | 0 |
| Authentication | 10 | 14 | 3 |
| Session Management | 9 | 5 | 6 |
| Access Control | 14 | 5 | 4 |
| Cryptographic | 3 | 3 | 0 |
| Error Handling & Logging | 8 | 10 | 2 |
| Data Protection | 8 | 4 | 0 |
| Communication Security | 7 | 1 | 0 |
| System Configuration | 9 | 7 | 0 |
| Database Security | 9 | 5 | 0 |
| File Management | 2 | 11 | 0 |
| Memory Management | 1 | 8 | 0 |
| General Coding | 10 | 3 | 0 |
| **TOTAL** | **99** | **89** | **16** |

### Status Perbaikan

| Status | ID | Deskripsi |
|--------|-----|-----------|
| ✅ DONE | RC-01 | Snake game state atomic (migration 008) |
| ✅ DONE | RC-02 | Cancel refund atomic (migration 008) |
| ✅ DONE | PAY-01 | `verify` cek `fraud_status` |
| ✅ DONE | PAY-02 | `verify` cek kepemilikan payment_reference |
| ✅ DONE | PAY-03 | Webhook hanya log non-sensitive fields |
| ✅ DONE | PAY-04 | `crypto.randomBytes()` untuk order ID |
| ✅ DONE | PAY-05 | `Cache-Control: no-store` untuk payment routes |
| ✅ DONE | SEC-02 | HSTS header ditambahkan |
| ✅ DONE | DEP-01 | Deprecated functions di-drop (migration 009) |
| ✅ DONE | DEP-02 | `.env.local.example` diperbarui |
| ✅ DONE | SEC-01 | Nonce-based CSP via `middleware.ts` (`unsafe-inline` dihapus) |
| ✅ DONE | LOG-01 | `lib/security-logger.ts` + logging di webhook & verify |

---

## 📌 Cara Penggunaan

1. Copy file ini ke root repository project kamu
2. Tandai item dengan `[x]` setelah selesai diimplementasikan
3. Item `[RACE]` dan `[PAY]` prioritaskan lebih dulu jika project kamu ada payment
4. Jadikan checklist ini bagian dari code review sebelum deployment ke production

---

> Sumber: [OWASP Secure Coding Practices Quick Reference Guide](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)  
> Versi ini ditambahkan label kontekstual `[RACE]` dan `[PAY]` untuk kemudahan penggunaan.  
> Audit dilakukan pada: 2026-04-27
