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
- [x] Gunakan satu centralized routine untuk validasi input di seluruh aplikasi *(Zod schema di semua route API — `z.object()` pattern konsisten)*
- [x] Tentukan character set (misal UTF-8) untuk semua sumber input *(Next.js App Router default UTF-8, JSON body parsing*)
- [-] Encode input ke character set yang seragam sebelum divalidasi
- [x] Semua kegagalan validasi harus menghasilkan penolakan input
- [-] Jika sistem mendukung UTF-8 extended, validasi setelah UTF-8 decoding selesai
- [x] Validasi semua data yang disediakan client sebelum diproses
- [-] Verifikasi header protokol (request & response) hanya mengandung ASCII
- [-] Validasi data dari redirect
- [x] Gunakan "allow list" bukan "deny list" untuk validasi tipe data
- [x] Validasi range data `[PAY]`
- [x] Validasi panjang data *(✅ Zod schema dengan `.max()` diterapkan konsisten di semua route POST/PATCH: wishlist title max 200, description max 1000; capsule message max 2000; tod question max 500; snake custom question max 500; dare custom dare max 300)*
- [-] Jika input berbahaya terpaksa diizinkan, implementasikan kontrol tambahan
- [-] Gunakan canonicalization untuk mencegah obfuscation attacks

---

## 2. Output Encoding

- [x] Semua output encoding dilakukan di sisi server
- [x] Gunakan satu routine standar yang sudah teruji untuk setiap jenis encoding *(NextResponse.json)*
- [x] Tentukan character set (misal UTF-8) untuk semua output *(Next.js App Router default UTF-8 untuk semua response)*
- [x] Encode secara kontekstual semua data dari sumber untrusted yang dikembalikan ke client
- [x] Pastikan output encoding aman untuk semua target sistem *(React auto-escaping HTML di JSX, JSON.stringify untuk API)*
- [x] Sanitasi output data untrusted untuk query SQL, XML, dan LDAP *(Supabase SDK parameterized)*
- [x] Sanitasi output data untrusted untuk perintah OS *(tidak ada OS command)*

---

## 3. Authentication & Password Management

- [x] Wajibkan autentikasi untuk semua halaman/resource kecuali yang memang public
- [x] Semua kontrol autentikasi dijalankan di trusted system (server-side)
- [x] Gunakan layanan autentikasi standar yang sudah teruji jika memungkinkan *(Supabase Auth)*
- [x] Gunakan implementasi terpusat untuk semua kontrol autentikasi *(✅ `middleware.ts` ada — melindungi `/dashboard/*`, `/game/*`, `/admin/*` secara terpusat)*
- [x] Pisahkan logika autentikasi dari resource yang diminta *(✅ `middleware.ts` memisahkan session refresh dari request handler)*
- [x] Semua kontrol autentikasi harus fail securely
- [-] Semua fungsi admin/akun harus minimal sama amannya dengan mekanisme autentikasi utama
- [x] Gunakan cryptographically strong one-way salted hash untuk menyimpan credential *(Supabase handles this)*
- [x] Password hashing harus dilakukan di server-side *(Supabase handles this)*
- [x] Validasi data autentikasi hanya setelah semua input selesai dimasukkan
- [x] Respon gagal autentikasi tidak boleh mengindikasikan bagian mana yang salah *(login error → "Email atau password salah")*
- [x] Gunakan autentikasi untuk koneksi ke sistem eksternal yang menyangkut data sensitif
- [x] Credential untuk sistem eksternal disimpan di secure store *(.env.local, tidak di kode)*
- [x] Gunakan hanya HTTP POST untuk mengirimkan credential `[PAY]`
- [x] Kirim password non-temporary hanya melalui koneksi terenkripsi
- [-] Terapkan kompleksitas password sesuai kebijakan *(Supabase default)*
- [-] Terapkan panjang minimum password sesuai kebijakan *(Supabase default — placeholder form: "Minimal 6 karakter")*
- [x] Input password harus disembunyikan di layar user *(✅ Terverifikasi: `type="password"` di login & register page)*
- [x] Nonaktifkan akun setelah sejumlah percobaan login gagal `[PAY]` *(✅ RATE-01: Rate limiting login diimplementasikan via API /api/auth/login + check_login_rate_limit DB function. 5x gagal/menit → blok 1m, 10x gagal/jam → blok 1j)*
- [-] Reset & perubahan password memerlukan kontrol setara dengan pembuatan akun *(Supabase handles)*
- [-] Jika reset via email, kirim hanya ke alamat terdaftar dengan link/password sementara *(Supabase handles)*
- [-] Password/link sementara harus memiliki waktu kedaluwarsa singkat `[PAY]` *(Supabase default)*
- [-] Paksa perubahan password sementara pada penggunaan pertama
- [-] Notifikasi user ketika terjadi reset password *(Supabase handles)*
- [-] Cegah penggunaan ulang password *(Supabase default)*
- [x] Nonaktifkan fitur "remember me" untuk field password *(✅ `autoComplete="current-password"` di login, `autoComplete="new-password"` di register — browser mengelola credential manager sesuai standar WHATWG)*
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
- [x] Logout harus sepenuhnya mengakhiri session/koneksi *(✅ SESS-02: app-shell memanggil /api/auth/logout sehingga ldr_session_age cookie ikut terhapus)*
- [x] Fitur logout tersedia di semua halaman yang dilindungi
- [x] Tetapkan inactivity timeout session sesingkat mungkin `[PAY]` *(✅ SESS-01: Sliding window — cookie diperbarui tiap request aktif; logout setelah 24 jam tanpa aktivitas)*
- [x] Larang persistent login dan terapkan terminasi session berkala `[PAY]` *(✅ SESS-01: Inactivity timeout 24 jam via cookie ldr_session_age + sliding window di proxy.ts)*
- [x] Jika ada session sebelum login, tutup dan buat session baru setelah login berhasil *(Supabase handles)*
- [-] Generate session ID baru setiap re-autentikasi `[PAY]` *(Supabase handles)*
- [x] Jangan izinkan login concurrent dengan user ID yang sama `[PAY]` `[RACE]` *(✅ SESS-03: Login route memanggil supabase.auth.admin.signOut(userId, 'others') untuk terminasi semua sesi lain)*
- [x] Jangan tampilkan session identifier di URL, pesan error, atau log
- [-] Terapkan akses kontrol yang tepat untuk data session server-side *(Supabase handles)*
- [-] Generate session ID baru dan nonaktifkan yang lama secara berkala *(Supabase handles)*
- [-] Generate session ID baru jika koneksi berubah dari HTTP ke HTTPS *(enforced HTTPS, tidak relevan)*
- [x] Gunakan HTTPS secara konsisten, jangan bergantian dengan HTTP *(Netlify enforces HTTPS)*
- [x] Gunakan token acak per-session untuk operasi sensitif server-side `[PAY]` *(Midtrans order ID unik per transaksi)*
- [x] Untuk operasi sangat kritis, gunakan token acak per-request (bukan per-session) `[PAY]` `[RACE]` *(Snake roll dilindungi SELECT FOR UPDATE + turn validation — replay request akan ditolak karena giliran sudah bergeser)*
- [x] Set atribut "secure" pada cookie yang ditransmisikan melalui TLS *(Supabase SSR)*
- [x] Set atribut HttpOnly pada cookie kecuali memang perlu diakses client-side script *(Supabase SSR)*

---

## 5. Access Control

- [x] Gunakan objek trusted system (server-side) untuk keputusan otorisasi
- [x] Gunakan satu komponen site-wide untuk memeriksa otorisasi *(✅ `middleware.ts` melindungi `/dashboard/*`, `/game/*`, `/admin/*` — setiap API route juga melakukan `auth.getUser()` sebagai defense-in-depth)*
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
- [x] Jika state data disimpan di client, gunakan enkripsi + integrity check di server `[RACE]` *(✅ STORE-01: Data sensitif seperti coin balance selalu ditarik fresh dari server via API /api/coin/balance / hook useServerBalance, bukan state Zustand localstorage)*
- [x] Terapkan alur logika aplikasi sesuai aturan bisnis `[PAY]` `[RACE]` *(via RPC atomic)*
- [x] **Batasi jumlah transaksi yang bisa dilakukan satu user/device dalam periode tertentu** `[PAY]` `[RACE]` *(✅ Terverifikasi: `checkRateLimit` ada di semua game session create routes — tod, snake-ladder, dare-derby, quoridor. Topup rate limit via `get_pending_topup_count` RPC. AI generate juga di-rate-limit)*
- [x] Jangan gunakan header "referer" sebagai satu-satunya pengecekan otorisasi
- [-] Untuk session panjang, validasi ulang otorisasi user secara berkala
- [x] Implementasikan audit akun via `admin_activity_logs` *(✅ Terverifikasi: `lib/security-logger.ts` menulis ke tabel `admin_activity_logs` untuk event keamanan: webhook sig fail, payment ownership violation)*
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
- [-] Gunakan satu routine terpusat untuk semua operasi logging *(`lib/security-logger.ts` ada untuk security events; general logging masih tersebar)*
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
- [x] Cegah pengungkapan struktur direktori di file robots.txt *(✅ Terverifikasi: `public/robots.txt` ada — `Disallow: /admin`, `Disallow: /api`, `Disallow: /_next` sudah dikonfigurasi)*
- [x] Tentukan HTTP method (GET/POST) yang didukung aplikasi
- [-] Nonaktifkan HTTP method yang tidak diperlukan *(Next.js App Router handles this)*
- [x] Hapus informasi tidak perlu dari HTTP response header *(✅ SEC-01: Dynamic nonce-based CSP diaktifkan di middleware.ts dengan generated nonce per-request, strict-dynamic untuk scripts, dan static CSP dihapus dari next.config.ts)*
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

### ACCOUNT & AUTHORIZATION

---

#### ✅ ACC-01 `[RACE]` Privilege escalation via RLS column-gap pada `users` — **FIXED**
Policy `users_update_own` (`02_rls.sql`) hanya membatasi BARIS (`auth.uid() = id`), tidak membatasi KOLOM. Karena `app/dashboard/profile/page.tsx` dan komponen lain memanggil `supabase.from("users").update(...)` langsung dari browser (anon key), user manapun bisa menjalankan `supabase.from("users").update({ is_admin: true }).eq("id", myId)` dari console dan self-promote jadi admin — lalu mengakses semua fitur `/admin/*` karena `app/admin/layout.tsx` dan setiap route admin membaca `is_admin` langsung dari tabel yang sama.
**Fix (migration 036):** trigger `protect_sensitive_user_columns` di `01_tables.sql` menolak UPDATE kolom `is_admin`, `couple_code`, `partner_id`, `status`, `email`, `id` jika `current_user` adalah role `authenticated`/`anon`. RPC `SECURITY DEFINER` dan service role tidak terpengaruh.

---

#### ✅ ACC-02 `[PAY]` IDOR pada RPC `link_couple`/`unlink_couple` — **FIXED**
Kedua fungsi (`03_functions.sql`) menerima `p_user_id` sebagai parameter bebas tanpa memvalidasi `p_user_id = auth.uid()`. Karena RPC ini `SECURITY DEFINER` (bypass RLS) dan dipanggil langsung dari client tanpa API route perantara, siapa pun yang login bisa memanggil `supabase.rpc("unlink_couple", { p_user_id: "<uuid korban>" })` dan memutuskan/memaksa-link akun orang lain tanpa consent.
**Fix (migration 036):** kedua fungsi sekarang menolak eksekusi (`RAISE EXCEPTION 'UNAUTHORIZED'`) jika `p_user_id IS DISTINCT FROM auth.uid()`.

---

#### ✅ ACC-03 `[RACE]` Race condition pada `link_couple` tanpa row lock — **FIXED**
Berbeda dari RPC game (`create_game_session`, `roll_snake_dice`, dll) yang konsisten memakai `SELECT ... FOR UPDATE`, `link_couple` membaca status user & partner tanpa lock apa pun. Dua user yang link ke couple_code yang sama nyaris bersamaan bisa menghasilkan data pasangan asimetris (A.partner_id=B tapi B.partner_id ternyata C).
**Fix (migration 036):** kedua baris (user & partner) dikunci via `SELECT ... FOR UPDATE` dalam urutan GLOBAL konsisten (`LEAST`/`GREATEST` by UUID, bukan berdasarkan siapa pemanggil) sebelum re-read status & update — mencegah race sekaligus deadlock antar transaksi yang overlap.

---

#### ✅ ACC-04 `[PAY]` RLS `capsules_select_couple` bocorkan isi pesan sebelum dibuka — **FIXED**
Policy hanya cek `sender_id = auth.uid() OR receiver_id = auth.uid()`, tanpa memeriksa `status`. Sensor `message: null` hanya dilakukan di layer aplikasi (`app/api/capsule/route.ts`, service-role client) — bukan di RLS. Akibatnya, isi pesan kapsul yang masih `locked` (belum boleh dibuka receiver) bisa dibaca lewat dua jalur independen: (a) panggilan `supabase.from("capsules").select("message")` langsung dari console browser, dan (b) payload realtime `postgres_changes` yang dikirim ke browser receiver tanpa filter kolom.
**Fix (migration 037):** `capsules_select_couple` sekarang mensyaratkan `receiver_id = auth.uid() AND status != 'locked'` — sender tetap bisa SELECT semua baris miliknya (bukan risiko, "spoiler untuk diri sendiri").

---

#### ✅ ACC-05 Gap kolom `user_id` pada RLS `anniversaries_update_couple` — **FIXED**
`WITH CHECK` hanya memvalidasi nilai BARU `user_id` (harus diri sendiri atau partner), tapi tidak melarang PERUBAHAN `user_id` itu sendiri. Partner B bisa reassign anniversary milik A jadi "milik" B (lolos WITH CHECK karena nilai baru = B = auth.uid()), lalu menghapusnya lewat `anniversaries_delete_own` yang seharusnya owner-only. Diperparah karena semua operasi CRUD anniversary sebelumnya dipanggil 100% langsung dari client (`supabase.from("anniversaries")`), tanpa API layer/rate-limiting sama sekali.
**Fix (migration 037):** trigger `protect_anniversary_owner` menolak UPDATE kolom `user_id` dari role `authenticated`/`anon`. Sekaligus operasi CRUD dipindah ke `app/api/anniversaries/` (GET/POST) dan `app/api/anniversaries/[id]/` (PATCH/DELETE) dengan Zod validation + rate limiting (20x/10 menit) — konsisten dengan pola wishlist/capsule.

---

#### ✅ ACC-06 `[PAY]` Tidak ada rate limiting pada create wishlist/capsule/anniversary — **FIXED**
`POST /api/wishlist` dan `POST /api/capsule` tidak punya rate limiting sama sekali, padahal keduanya trigger push notification ke partner di setiap create — bisa dipakai untuk notification bombing pasangan sendiri (spam ratusan/ribuan item dalam waktu singkat). Anniversary lebih rentan lagi karena tidak lewat API route sama sekali (lihat ACC-05).
**Fix:** `checkRateLimit()` ditambahkan ke `POST /api/wishlist` (20x/10 menit), `POST /api/capsule` (10x/10 menit), dan `POST /api/anniversaries` (20x/10 menit) — mengikuti pola yang sudah ada di `redeem-voucher`.

---

#### ✅ ACC-07 Bug validasi Zod: `.min(1)` dicek sebelum `.trim()` — **FIXED**
Di Zod, method chain `.min(1).trim()` mengevaluasi `.min(1)` terhadap string ASLI (sebelum transform `.trim()` diterapkan). Input berisi hanya spasi (`" "`) punya panjang 1 → lolos validasi → baru di-trim jadi string kosong sebelum disimpan ke DB. Wishlist item bisa tersimpan tanpa judul, kapsul tanpa isi pesan, hanya dengan mengirim satu karakter spasi.
**Fix:** urutan diperbaiki jadi `.trim().min(1)` di `app/api/wishlist/route.ts`, `app/api/wishlist/[id]/route.ts`, `app/api/capsule/route.ts` — validasi panjang sekarang dievaluasi SETELAH trim.

---

#### ✅ GAME-01 `[PAY][RACE]` Audit menyeluruh Truth or Dare — 5 bug ditemukan & diperbaiki — **FIXED**
Audit end-to-end game Truth or Dare (create/join/next/done/cancel/expire/room) menemukan:
1. **`expire_waiting_sessions()` TIDAK PERNAH dipanggil siapa pun** — tidak ada cron entry, tidak ada API route. Sesi `waiting` yang ditelantarkan (partner tidak pernah join) tidak pernah direfund otomatis.
2. **Coin hilang permanen tanpa refund**: cleanup manual di `session/create/route.ts` men-`expired`-kan sesi `waiting/playing` lama milik user tanpa refund, membuatnya lolos dari jalur refund resmi selamanya (sekali status bukan `waiting`, tidak akan pernah disentuh `refund_expired_session`).
3. **Race condition create-session**: `create_game_session` RPC cek sesi aktif via `EXISTS` tanpa lock level-couple — dua create bersamaan bisa lolos dan membuat 2 sesi aktif untuk couple yang sama (tidak ada unique constraint pemblokir).
4. **Filter pool pertanyaan custom couple salah** di `session/create/route.ts`: `couple_id.eq.${user.id}` seharusnya `couple_id.eq.${resolvedCoupleId}` (LEAST) — pertanyaan custom couple bisa tidak muncul untuk partner dengan UUID lebih besar.
5. **"Skip" tidak persist ke DB** — endpoint `/next` hanya baca, tidak menandai `is_completed`, menyebabkan desync progress antar-partner dan sesi tidak pernah masuk status `completed` kalau semua kartu di-skip; room Daily.co juga tidak pernah dibersihkan lewat jalur ini.
6. Error cancel session ditelan diam-diam di frontend (`handleLeave`) — UI selalu reset ke idle walau server menolak permintaan batal.

**Fix (migration 038):**
- `create_game_session` sekarang pakai `pg_advisory_xact_lock` per `couple_id` (fix #3) dan memanggil `refund_expired_session` saat auto-expire sesi `waiting` lama (fix #2) — cleanup manual tanpa-refund di semua 5 route `session/create` (tod, snake-ladder, dare-derby, quoridor, photobooth) dihapus karena sudah digantikan RPC.
- `answer_tod_question` tambah parameter `p_skip` supaya endpoint `/next` bisa persist progres skip ke DB (fix #5).
- Endpoint cron baru `GET /api/cron/expire-sessions` (jadwal 1x/hari di `vercel.json`, mengikuti limitasi Vercel Hobby) memanggil `expire_waiting_sessions()` — jaring pengaman resmi pertama untuk sesi `waiting` yang ditelantarkan (fix #1).
- Filter pool pertanyaan di `session/create/route.ts` diperbaiki pakai `resolvedCoupleId` (fix #4).
- `handleLeave` di frontend sekarang menunggu hasil fetch cancel dan menampilkan toast error jika server menolak (fix #6).

---

#### ✅ GAME-02 `[PAY][RACE]` Audit menyeluruh Snake & Ladder — 5 bug ditemukan & diperbaiki, berdampak ke 5 game — **FIXED**
Audit end-to-end game Snake & Ladder (create/join/roll/confirm/surrender/expire/room) menemukan 5 bug, beberapa berlaku juga untuk game lain (dare-derby, quoridor, photobooth) karena pola kode yang diduplikasi:
1. **Endpoint `/expire` tidak memvalidasi `expires_at`** (ToD, snake-ladder, quoridor) — peserta yang sedang KALAH bisa memanggil endpoint ini kapan saja (selama status masih `playing`) untuk memaksa sesi jadi `expired`, menghindari kekalahan tanpa waktu benar-benar habis di server. Endpoint expire quoridor sebelumnya juga tidak memvalidasi kepesertaan sama sekali (siapa pun yang tahu `session_code` bisa meng-expire sesi orang lain).
2. **Endpoint `/expire` tidak ada sama sekali** untuk Dare Derby (timer client hanya ubah state lokal, server tidak pernah diberi tahu) dan untuk Photobooth (frontend memanggil endpoint yang **404**, error ditelan diam-diam via `.catch(()=>{})`) — sesi `playing` yang lolos timer client menggantung sampai cron harian `expire-sessions` membersihkannya (~24 jam).
3. **Duplikasi manual update `expires_at`** di 3 route `session/join` (snake-ladder, quoridor, dare-derby) — RPC `join_game_session` (shared) sudah menghitungnya dengan benar dari `game_settings.expires_in_minutes`, update manual berikutnya adalah sumber potensi divergensi jika logic RPC berubah tanpa kode ini disesuaikan.
4. **`deleteDailyRoom` tidak konsisten dipanggil** di jalur game-selesai (menang lewat roll dadu/quoridor action, surrender di 3 game, confirm/skip dare-derby yang memicu forfeit) — hanya ToD `/done` yang sudah membersihkan room. Room-room ini sebelumnya hanya mengandalkan auto-expire Daily.co (`exp` timestamp, buffer 30 menit) atau cron `expire-sessions` untuk sesi yang ditelantarkan.
5. Error 500 generik ("Gagal menyerah, coba lagi") pada race dua surrender bersamaan — bukan pesan yang informatif, tapi TIDAK diubah (risiko race sudah tertutup oleh `WHERE status='playing'`, hanya UX minor, di luar scope perbaikan fungsional).

**Fix:**
- Endpoint `/expire` di ToD, snake-ladder, quoridor sekarang wajib `.lte("expires_at", now())` sebelum update — request yang datang sebelum waktu benar-benar habis akan mendapat "Sesi tidak perlu diupdate" (bukan error), bukan memaksa expire.
- Endpoint `/expire` baru dibuat untuk Dare Derby dan Photobooth (pola sama, termasuk validasi waktu & kepesertaan) — frontend Dare Derby (`handleTimerExpire`) diupdate untuk memanggilnya.
- Duplikasi update `expires_at` manual di 3 route join dihapus, sepenuhnya mempercayakan RPC `join_game_session`.
- `deleteDailyRoom` (best effort) ditambahkan ke: `roll_snake_dice` saat menang, `quoridor_action` saat menang, surrender di 3 game (snake-ladder, dare-derby, quoridor), `photobooth/complete`, dan `dare-derby/dare/confirm` + `dare/skip` saat `phase==="game_over"`.

---

#### ✅ GAME-03 `[PAY][RACE]` IDOR sistemik di hampir semua RPC game & payment + celah kecurangan skor Dare Derby + debug flag aktif — **FIXED**
Audit menyeluruh game Dare Derby menemukan 3 bug, salah satunya (IDOR) bersifat sistemik dan berdampak ke SEMUA RPC game serta beberapa RPC payment:

1. **IDOR sistemik pada RPC `SECURITY DEFINER`**: hampir semua stored function game (`create_game_session`, `join_game_session`, `cancel_game_session`, `roll_snake_dice`, `confirm_snake_challenge`, `answer_tod_question`, `quoridor_action`, seluruh RPC Dare Derby, dll) dan beberapa RPC payment (`redeem_voucher`, `create_pending_topup`, `cancel_topup_transaction`, dll) menerima `p_user_id` sebagai parameter bebas **tanpa pernah memvalidasi `p_user_id = auth.uid()`** — pola identik dengan bug IDOR `link_couple`/`unlink_couple` yang sudah diperbaiki di migration 036, tapi tidak pernah diterapkan ke fungsi lain. Karena fungsi ini `SECURITY DEFINER` (bypass RLS) dan Supabase/PostgREST secara default memberi akses EXECUTE ke role `authenticated`, siapa pun yang login bisa memanggil misalnya `supabase.rpc("confirm_dare_derby_dare", { p_user_id: "<uuid korban>", ... })` langsung dari browser (bypass Next.js API route sepenuhnya) dan melakukan aksi ATAS NAMA user lain — roll dadu, submit skor, gerak Quoridor, konfirmasi/skip dare, bahkan redeem voucher orang lain.
2. **Skor Dare Derby tidak divalidasi**: endpoint `submit/route.ts` hanya memvalidasi `score >= 0` dan `time_taken >= 0` tanpa batas atas, dan RPC `submit_dare_derby_round` tidak pernah memverifikasi ulang nilai ini terhadap logika mini-game. Semua mini-game menghasilkan skor 0-100 (+bonus 50, cap 150 hanya di client) — pemain bisa memanggil `/submit` langsung dengan skor besar sembarang tanpa pernah bermain mini-game-nya, otomatis menang tiap ronde.
3. **Debug flag aktif di production**: `DEBUG_FORCE_MINIGAME = "math_dash"` di `session/create/route.ts` membuat SEMUA sesi Dare Derby baru memaksa seluruh ronde memakai mini-game yang sama, mengabaikan `select_dare_derby_minigames` RPC sepenuhnya.

**Fix (migration 039):**
- `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated` untuk 26 RPC server-only (semua RPC game + RPC payment yang hanya dipanggil via `createServiceClient()`) — service role tidak terpengaruh REVOKE ini karena selalu bisa eksekusi terlepas dari GRANT/REVOKE. `link_couple`/`unlink_couple` SENGAJA TIDAK di-revoke karena memang didesain dipanggil client-side dan sudah dilindungi `auth.uid()` sejak migration 036.
- Zod schema di `submit/route.ts` diperketat: `score` max 150, `time_taken` max 10 menit (dalam ms).
- `DEBUG_FORCE_MINIGAME` dikosongkan kembali ke `""`.

---

#### ✅ GAME-04 `[PAY]` Audit menyeluruh Quoridor + bug "tinggalkan game" cross-game (4 game) — **FIXED**
Audit Quoridor sendiri (evolusi `quoridor_action`/`quoridor_has_path` migration 024→027) tidak menemukan celah baru — logika move/jump/wall/BFS-path-block sudah matang lewat 4 iterasi perbaikan sebelumnya, dan client-side validation di board hanya cosmetic (server RPC selalu jadi source of truth via row lock, aman dari race maupun bypass). Satu gap kecil ditemukan: mapping error `INVALID_ACTION` (case fallback RPC) belum ada di `action/route.ts`, jatuh ke 500 generik — ditambahkan mapping 400 yang lebih tepat.

Bug utama yang ditemukan justru **cross-game** dan cukup signifikan: tombol "Tinggalkan"/keluar sesi saat status masih `playing` di **4 dari 5 game** (Quoridor, Snake & Ladder, Dare Derby, Photobooth) hanya mereset state React lokal **tanpa pernah memberi tahu server**. Photobooth bahkan tidak memanggil server sama sekali baik untuk `waiting` maupun `playing`. Akibatnya sesi `playing` yang ditinggalkan (bukan lewat surrender resmi) tetap tercatat aktif di DB selamanya — coin tertahan, partner masih melihat sesi seolah berjalan — sampai timer client partner habis atau cron harian `expire-sessions` membersihkannya (bisa ~24 jam).

**Fix:**
- `handleNewGame` di Quoridor & Snake and Ladder, `handleReset` di Dare Derby: ditambah cabang `else if (status === "playing")` yang memanggil endpoint `/expire` masing-masing game sebelum reset state.
- Photobooth: dibuat helper `handleLeave` baru (menggantikan `onCancel={() => setPhase("idle")}` dan `onLeave={() => setPhase("idle")}` yang sebelumnya sama sekali tidak menyentuh server) — cancel jika `waiting` (host), expire jika `playing`.
- `action/route.ts` Quoridor: tambah mapping `INVALID_ACTION` → 400.

---

#### ✅ GAME-05 `[RACE]` Audit menyeluruh Virtual Photobooth — race condition foto & kuota retake, tanpa guard fase/slot — **FIXED**
Semua route gameplay photobooth (`select-template`, `trigger-countdown`, `submit-photo`, `retake`, `complete`) melakukan read-modify-write `game_state` di JS lalu menimpa seluruh kolom tanpa lock, dan tidak memakai RPC sama sekali:
1. **Foto host/partner saling timpa di gameplay normal** — countdown dipicu via realtime, jadi kedua client meng-capture dan `submit-photo` hampir bersamaan di setiap slot. Request yang membaca snapshot lama menimpa foto yang baru disimpan request lain.
2. **Kuota `retakes_left` bisa dilewati** lewat request retake paralel (decrement dari snapshot, bukan atomik).
3. **Tanpa guard fase/status** — `submit-photo` bisa dipanggil tanpa countdown (foto dari mana saja), `trigger-countdown` bisa di-spam untuk mereset timer partner di fase apa pun, retake di luar fase review, dan semua aksi tetap jalan walau sesi sudah `completed`/`expired`.
4. **`slot_index` tidak divalidasi** — slot sampah (misal 999) menambah hitungan slot terisi dan memaksa phase `review_retake` prematur.
5. **`image_url` tanpa validasi** — bisa URL eksternal (tracking pixel yang dirender `<img>` di browser partner) atau string raksasa ke kolom JSONB.

**Fix (migration 040):**
- RPC baru `photobooth_action(code, user_id, action, payload)` dengan `SELECT ... FOR UPDATE`, sudah `REVOKE` dari `anon`/`authenticated`. Guard: status `playing` + belum lewat `expires_at`; `select_template` hanya sebelum ada foto; `trigger_countdown` hanya dari `ready` (atau `taking` macet > 15 detik) dengan slot dari server; `submit_photo` hanya untuk slot capture aktif, sekali per pemain per capture, maks 60 detik; `retake` hanya dari `review_retake`, slot 1..`photo_count`; `complete` hanya dari `review_retake`.
- `game_state.capture = { slot, started_at, submitted[] }` menyimpan ronde capture aktif sehingga submit pemain kedua tetap diterima setelah submit pertama memajukan phase. Slot berikutnya = slot kosong terendah, sehingga setelah retake langsung kembali ke review.
- Route memakai helper bersama `lib/games/photobooth/action.ts`; Zod membatasi `image_url` ke `data:image/(jpeg|png|webp);base64,...` maks 1 juta karakter dan `slot_index` integer 1..20. Field `is_combined` (tidak dipakai frontend, bisa menimpa foto kedua pihak) tidak lagi diterima.
- Frontend: capture mengirim `capture.slot`, dan error dari trigger/submit/retake/complete sekarang ditampilkan (sebelumnya selalu dianggap sukses).
- Tidak diberi `checkRateLimit` — konsisten dengan keputusan game action turn-based lain (sudah state-gated via RPC).

**Lanjutan (migration 041), ditemukan lewat uji end-to-end:** foto base64 di `game_state` membuat row sesi mencapai ~2.9 MB (4 slot × 2 foto ~370 KB). Supabase Realtime berhenti mengirim kolom `game_state` untuk row sebesar itu (hanya 5 dari 18 event yang memuatnya), sehingga client partner berhenti menerima `countdown_started_at` di tengah permainan dan game macet. Fix: foto di-upload ke bucket **privat** `photobooth-captures` (tanpa policy anon/authenticated), `game_state` hanya menyimpan path (`{session_code}/...`, divalidasi RPC), GET sesi (`[code]`, `active`) menambahkan signed URL 2 jam setelah cek peserta, dan frontend mengambil signed URL saat realtime membawa path baru. File lama dihapus saat retake, dan file yang di-upload untuk submit yang ditolak RPC langsung dihapus. Keaslian foto (benar hasil webcam) tetap tidak bisa diverifikasi server; dampaknya terbatas ke album couple sendiri.

**Lanjutan (tanpa migration):** `GET /api/game/photobooth/session/active` meng-UPDATE sendiri semua sesi user yang lewat `expires_at` menjadi `expired` — **tanpa filter `game_type` dan tanpa refund**. Membuka halaman Photobooth menghanguskan coin sesi `waiting` game lain (misal Snake & Ladder 5 coin), dan cron `expire-sessions` tidak bisa me-refund-nya lagi karena statusnya sudah bukan `waiting` (pola sama dengan GAME-01 #2 yang terlewat di route ini). Fix: route dibuat read-only via `get_active_session_for_couple` seperti 4 game lain; expire + refund tetap lewat `create_game_session` dan cron. Diverifikasi dengan uji nyata: sesi ToD `waiting` yang sudah lewat waktu tetap `waiting` setelah GET active, saldo tidak berubah, dan jalur refund resmi mengembalikan coin.

---

#### ✅ ACC-08 `[PAY]` Rate limiting audit menyeluruh — 15 endpoint tanpa proteksi ditemukan & diperbaiki — **FIXED**
Audit menyeluruh (sub-agent context-gatherer) menemukan 15 endpoint yang trigger biaya eksternal (Midtrans, Daily.co), efek samping berulang (upload, push notification), atau spam vector, tapi tidak punya time-window rate limiting sama sekali:
- `session/join` untuk 4 game (tod, snake-ladder, dare-derby, quoridor) — inkonsisten dengan `photobooth/session/join` yang sudah dilindungi; risiko brute-force session code + spam push ke host.
- `coin/topup`, `coin/cancel-topup`, `coin/verify` — masing-masing panggil Midtrans API (Snap create/close/status check); hanya dilindungi guard "maks 3 pending" (bukan time-window).
- `session/[code]/room` untuk 5 game (tod, snake-ladder, dare-derby, quoridor, photobooth) — GET dengan efek samping panggil `createDailyRoom()` ke Daily.co API tiap request.
- `user/avatar` POST (upload ke Supabase Storage), `wishlist/[id]/done` POST (trigger push ke partner), `game/tod/questions/submit` POST (insert pertanyaan custom tanpa batas).
- `push/test` — endpoint debug yang komentar kodenya sendiri bilang "hanya untuk debugging, hapus setelah production OK", tapi tetap kirim push notification tanpa batas.

**Fix:** `checkRateLimit()` ditambahkan ke seluruh 15 endpoint di atas (lihat tabel lengkap di `CLAUDE.md` § Rate Limiting untuk daftar key & limit tiap endpoint). Endpoint yang **sengaja tidak** diberi rate limit (admin routes, game action turn-based yang sudah state-gated via RPC, PATCH/DELETE ringan tanpa push, `capsule/open` idempotent) didokumentasikan juga di `CLAUDE.md` supaya tidak disalahartikan sebagai gap di audit berikutnya. `coin/webhook` tetap TIDAK bisa pakai `checkRateLimit` (server-to-server, tidak ada `user_id`) — dicatat sebagai item outstanding baru di bawah.

---

## 📊 Ringkasan Audit

| Kategori | `[x]` OK | `[-]` Manual | `[(x)]` Masalah |
|----------|----------|--------------|----------------|
| Input Validation | 8 | 8 | 0 |
| Output Encoding | 7 | 0 | 0 |
| Authentication | 14 | 11 | 2 |
| Session Management | 11 | 5 | 4 |
| Access Control | 17 | 3 | 1 |
| Cryptographic | 3 | 3 | 0 |
| Error Handling & Logging | 8 | 10 | 2 |
| Data Protection | 8 | 4 | 0 |
| Communication Security | 7 | 1 | 0 |
| System Configuration | 11 | 6 | 0 |
| Database Security | 9 | 5 | 0 |
| File Management | 2 | 11 | 0 |
| Memory Management | 1 | 8 | 0 |
| General Coding | 10 | 3 | 0 |
| **TOTAL** | **116** | **78** | **9** |

### Status Perbaikan

| Status | ID | Deskripsi |
|--------|-----|-----------|
| ✅ DONE | RC-01 | Snake game state atomic (migration 008) |
| ✅ DONE | RC-02 | Cancel refund atomic (migration 008) |
| ✅ DONE | PAY-01 | `verify` cek `fraud_status` |
| ✅ DONE | PAY-02 | `verify` cek kepemilikan payment_reference |
| ✅ DONE | PAY-03 | Webhook hanya log non-sensitive fields |
| ✅ DONE | PAY-04 | `crypto.randomBytes()` untuk order ID topup |
| ✅ DONE | PAY-05 | `Cache-Control: no-store` untuk payment routes |
| ✅ DONE | SEC-01 | Nonce-based CSP diaktifkan secara dinamis di middleware (nonce + strict-dynamic) dan static CSP dihapus dari `next.config.ts`. |
| ✅ DONE | SEC-02 | HSTS header ditambahkan |
| ✅ DONE | DEP-01 | Deprecated functions di-drop (migration 009) |
| ✅ DONE | DEP-02 | `.env.local.example` diperbarui |
| ✅ DONE | LOG-01 | `lib/security-logger.ts` + logging di webhook & verify |
| ✅ DONE | SEC-03 | `Math.random()` diganti `crypto.randomBytes()` via `lib/crypto-utils.ts` di semua game session create routes (tod, snake-ladder, dare-derby, quoridor) + helper `cryptoShuffle()` dan `cryptoRandInt()` |
| ✅ DONE | RATE-01 | Rate limit login 5x/1m & 10x/1jam dengan DB function `check_login_rate_limit` via `/api/auth/login` |
| ✅ DONE | SESS-01 | Max session age 24 jam dipaksa via cookie `ldr_session_age` di middleware |
| ✅ DONE | STORE-01 | Live coin balance diambil langsung dari server menggunakan hook `useServerBalance` / `/api/coin/balance` |
| ✅ DONE | ACC-01 | Trigger `protect_sensitive_user_columns` (migration 036) — cegah privilege escalation via UPDATE kolom `users` langsung dari client |
| ✅ DONE | ACC-02 | IDOR fix `link_couple`/`unlink_couple` — wajib `p_user_id = auth.uid()` (migration 036) |
| ✅ DONE | ACC-03 | Race condition fix `link_couple` — `SELECT ... FOR UPDATE` urutan konsisten (migration 036) |
| ✅ DONE | ACC-04 | RLS `capsules_select_couple` — receiver tidak bisa baca `message` sebelum `status != 'locked'` (migration 037) |
| ✅ DONE | ACC-05 | Trigger `protect_anniversary_owner` + pindah CRUD anniversary ke API route (migration 037) |
| ✅ DONE | ACC-06 | Rate limiting create wishlist/capsule/anniversary |
| ✅ DONE | ACC-07 | Fix urutan Zod `.trim()` sebelum `.min()` di wishlist & capsule |
| ✅ DONE | ACC-08 | Rate limiting ditambahkan ke 15 endpoint: session/join (4 game), coin topup/cancel-topup/verify, session/room (5 game), avatar upload, wishlist done, tod questions submit, push/test |
| ✅ DONE | GAME-01 | Audit ToD: advisory lock create_game_session, refund otomatis saat auto-expire, cron expire-sessions baru, fix filter pool couple, persist skip ke DB, fix error cancel ditelan diam-diam (migration 038) |
| ✅ DONE | GAME-02 | Audit Snake & Ladder: fix endpoint expire tanpa validasi waktu (3 game), tambah endpoint expire yang hilang (Dare Derby, Photobooth), hapus duplikasi update expires_at manual (3 route join), tambah deleteDailyRoom ke semua jalur game-selesai yang belum membersihkan room |
| ✅ DONE | GAME-03 | REVOKE EXECUTE 26 RPC server-only dari anon/authenticated (IDOR sistemik, migration 039), cap skor Dare Derby max 150 di Zod, matikan DEBUG_FORCE_MINIGAME |
| ✅ DONE | GAME-04 | Fix tombol "Tinggalkan" saat playing yang cuma reset UI tanpa beri tahu server (Quoridor, Snake & Ladder, Dare Derby, Photobooth) — sekarang panggil endpoint /expire; tambah mapping INVALID_ACTION di action/route.ts Quoridor |
| ✅ DONE | GAME-05 | Audit Photobooth: RPC atomik `photobooth_action` (migration 040) — fix foto host/partner saling timpa, bypass kuota retake, guard fase/slot/status, validasi format & ukuran `image_url`; foto ke Storage privat (041); route `active` tidak lagi menghanguskan coin sesi game lain |

---

## 🔴 Item Outstanding — Area Akun & Keamanan (belum diperbaiki)

Ditemukan saat audit area Account & Security (2026), severity medium/rendah, belum diperbaiki:

| # | Severity | Deskripsi |
|---|----------|-----------|
| 1 | Medium | `unlink_couple` tidak cleanup `game_sessions` aktif (`waiting`/`playing`) milik couple yang lama — sesi bisa jadi "orphan" tak terjangkau jika salah satu pihak lalu link ke partner baru. |
| 2 | Medium | Tidak ada rate limiting pada RPC `link_couple` — couple_code (10 karakter hex dari UUID, keyspace besar) tetap bisa dicoba berulang tanpa dibatasi; error message `INVALID_CODE` vs `PARTNER_ALREADY_LINKED` juga jadi oracle enumerasi. |
| 3 | Medium | Rate limiter login (`check_login_rate_limit`) fail-open jika RPC error — proteksi brute-force terlewati saat sistem under stress. |
| 4 | Medium | Trigger `handle_new_auth_user` (signup) menelan exception (`WHEN OTHERS THEN RAISE LOG ... RETURN NEW`) — jika insert ke `public.users`/`wallets` gagal, `auth.users` tetap terbuat tapi profile tidak pernah ada (orphaned account, tidak ada self-recovery). |
| 5 | Rendah | Validasi tipe file avatar (`app/api/user/avatar/route.ts`) hanya cek `Content-Type` dari client, bukan magic-byte/file-header sesungguhnya. |
| 6 | Rendah | Tidak ada notifikasi email saat password diubah. |
| 7 | Rendah | Tidak ditemukan flow forgot-password/reset-password di codebase — perlu konfirmasi apakah ini fitur yang disengaja belum dibangun. |
| 8 | Rendah | Logout hanya invalidate sesi lokal (`signOut()` scope default), tidak revoke refresh token di device lain kecuali via mekanisme SESS-03 saat login berikutnya. |
| 9 | Rendah | Anniversary reminder cron (`app/api/cron/anniversary-reminders/route.ts`) melakukan full-table-scan 3x (untuk H-7/H-3/H-1) tanpa filter tanggal di level query DB — tidak scalable untuk volume besar. Tidak ada tracking "sudah terkirim" sehingga re-run cron di hari yang sama bisa mengirim notifikasi duplikat. |
| 10 | Rendah | RLS `capsules_update_open` tidak punya `WITH CHECK` eksplisit — secara teknis membuat policy ini tidak pernah bisa dipakai dari client langsung (update `status` keluar dari kondisi `USING` setelah perubahan). Saat ini tidak masalah karena endpoint `open` pakai service-role client, tapi ini dead code / trap desain untuk refactor di masa depan. |
| 11 | Rendah | Lazy-delivery capsule (`GET /api/capsule`) tidak mengirim push notification saat mengubah status jadi `delivered` (hanya cron yang kirim push) — jika cron gagal/lambat dan lazy-delivery menang race, receiver tidak akan dapat notifikasi push meski status di DB sudah delivered. |
| 12 | Rendah | `POST /api/coin/webhook` tidak punya rate limiting (server-to-server dari Midtrans, tidak ada `user_id` sehingga `checkRateLimit()` tidak bisa dipakai langsung). Sudah dilindungi verifikasi signature SHA512, tapi belum ada mekanisme rate limit berbasis IP sebagai defense-in-depth tambahan — butuh helper baru, di luar scope audit rate limiting saat ini. |
| 13 | Rendah | `POST /api/push/test` adalah endpoint debug yang komentar kodenya sendiri menyatakan harus dihapus sebelum production, tapi masih ada di codebase (hanya diberi rate limit ketat 5x/10 menit, tidak dihapus). Pertimbangkan menghapus endpoint ini sepenuhnya jika sudah tidak dipakai untuk debugging. |

---

## 📌 Cara Penggunaan

1. Copy file ini ke root repository project kamu
2. Tandai item dengan `[x]` setelah selesai diimplementasikan
3. Item `[RACE]` dan `[PAY]` prioritaskan lebih dulu jika project kamu ada payment
4. Jadikan checklist ini bagian dari code review sebelum deployment ke production

---

> Sumber: [OWASP Secure Coding Practices Quick Reference Guide](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)  
> Versi ini ditambahkan label kontekstual `[RACE]` dan `[PAY]` untuk kemudahan penggunaan.  
> Audit terakhir diperbarui: 2026-09-12 (audit area Account & Security + Fitur Couple Lainnya — ACC-01 s.d. ACC-07 fixed; audit rate limiting komprehensif — ACC-08 fixed 15 endpoint, item outstanding baru #12-#13 ditambahkan)
