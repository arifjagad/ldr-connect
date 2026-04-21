# 🔐 OWASP Secure Coding Practices — Checklist

> Berdasarkan [OWASP Secure Coding Practices Quick Reference Guide](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)
> 
> ⚠️ Item bertanda `[RACE]` kritis untuk **race condition** | Item bertanda `[PAY]` kritis untuk **payment gateway**

---

## 1. Input Validation

- [ ] Validasi semua input dilakukan di sisi server (bukan client-side)
- [ ] Identifikasi semua sumber data dan klasifikasikan mana yang trusted/untrusted
- [ ] Validasi semua data dari sumber untrusted (database, file stream, dll)
- [ ] Gunakan satu centralized routine untuk validasi input di seluruh aplikasi
- [ ] Tentukan character set (misal UTF-8) untuk semua sumber input
- [ ] Encode input ke character set yang seragam sebelum divalidasi
- [ ] Semua kegagalan validasi harus menghasilkan penolakan input
- [ ] Jika sistem mendukung UTF-8 extended, validasi setelah UTF-8 decoding selesai
- [ ] Validasi semua data yang disediakan client sebelum diproses
- [ ] Verifikasi header protokol (request & response) hanya mengandung ASCII
- [ ] Validasi data dari redirect
- [ ] Gunakan "allow list" bukan "deny list" untuk validasi tipe data
- [ ] Validasi range data `[PAY]`
- [ ] Validasi panjang data
- [ ] Jika input berbahaya terpaksa diizinkan, implementasikan kontrol tambahan
- [ ] Gunakan canonicalization untuk mencegah obfuscation attacks

---

## 2. Output Encoding

- [ ] Semua output encoding dilakukan di sisi server
- [ ] Gunakan satu routine standar yang sudah teruji untuk setiap jenis encoding
- [ ] Tentukan character set (misal UTF-8) untuk semua output
- [ ] Encode secara kontekstual semua data dari sumber untrusted yang dikembalikan ke client
- [ ] Pastikan output encoding aman untuk semua target sistem
- [ ] Sanitasi output data untrusted untuk query SQL, XML, dan LDAP
- [ ] Sanitasi output data untrusted untuk perintah OS

---

## 3. Authentication & Password Management

- [ ] Wajibkan autentikasi untuk semua halaman/resource kecuali yang memang public
- [ ] Semua kontrol autentikasi dijalankan di trusted system (server-side)
- [ ] Gunakan layanan autentikasi standar yang sudah teruji jika memungkinkan
- [ ] Gunakan implementasi terpusat untuk semua kontrol autentikasi
- [ ] Pisahkan logika autentikasi dari resource yang diminta
- [ ] Semua kontrol autentikasi harus fail securely
- [ ] Semua fungsi admin/akun harus minimal sama amannya dengan mekanisme autentikasi utama
- [ ] Gunakan cryptographically strong one-way salted hash untuk menyimpan credential
- [ ] Password hashing harus dilakukan di server-side
- [ ] Validasi data autentikasi hanya setelah semua input selesai dimasukkan
- [ ] Respon gagal autentikasi tidak boleh mengindikasikan bagian mana yang salah
- [ ] Gunakan autentikasi untuk koneksi ke sistem eksternal yang menyangkut data sensitif
- [ ] Credential untuk sistem eksternal disimpan di secure store
- [ ] Gunakan hanya HTTP POST untuk mengirimkan credential `[PAY]`
- [ ] Kirim password non-temporary hanya melalui koneksi terenkripsi
- [ ] Terapkan kompleksitas password sesuai kebijakan
- [ ] Terapkan panjang minimum password sesuai kebijakan
- [ ] Input password harus disembunyikan di layar user
- [ ] Nonaktifkan akun setelah sejumlah percobaan login gagal `[PAY]`
- [ ] Reset & perubahan password memerlukan kontrol setara dengan pembuatan akun
- [ ] Jika reset via email, kirim hanya ke alamat terdaftar dengan link/password sementara
- [ ] Password/link sementara harus memiliki waktu kedaluwarsa singkat `[PAY]`
- [ ] Paksa perubahan password sementara pada penggunaan pertama
- [ ] Notifikasi user ketika terjadi reset password
- [ ] Cegah penggunaan ulang password
- [ ] Nonaktifkan fitur "remember me" untuk field password
- [ ] Tampilkan informasi penggunaan akun terakhir saat login berikutnya
- [ ] Implementasikan monitoring untuk mendeteksi serangan terhadap multiple akun
- [ ] Ubah semua password/user ID default dari vendor atau nonaktifkan akun tersebut
- [ ] Re-autentikasi user sebelum operasi kritis `[PAY]` `[RACE]`
- [ ] Gunakan Multi-Factor Authentication untuk akun bertransaksi sensitif `[PAY]`
- [ ] Jika menggunakan kode pihak ketiga untuk autentikasi, periksa tidak ada kode jahat

---

## 4. Session Management

- [ ] Gunakan session management bawaan server/framework
- [ ] Pembuatan session identifier selalu dilakukan di server-side
- [ ] Gunakan algoritma yang menghasilkan session ID yang cukup acak
- [ ] Set domain dan path cookie session ke nilai yang sesuai dan terbatas
- [ ] Logout harus sepenuhnya mengakhiri session/koneksi
- [ ] Fitur logout tersedia di semua halaman yang dilindungi
- [ ] Tetapkan inactivity timeout session sesingkat mungkin `[PAY]`
- [ ] Larang persistent login dan terapkan terminasi session berkala `[PAY]`
- [ ] Jika ada session sebelum login, tutup dan buat session baru setelah login berhasil
- [ ] Generate session ID baru setiap re-autentikasi `[PAY]`
- [ ] Jangan izinkan login concurrent dengan user ID yang sama `[PAY]` `[RACE]`
- [ ] Jangan tampilkan session identifier di URL, pesan error, atau log
- [ ] Terapkan akses kontrol yang tepat untuk data session server-side
- [ ] Generate session ID baru dan nonaktifkan yang lama secara berkala
- [ ] Generate session ID baru jika koneksi berubah dari HTTP ke HTTPS
- [ ] Gunakan HTTPS secara konsisten, jangan bergantian dengan HTTP
- [ ] Gunakan token acak per-session untuk operasi sensitif server-side `[PAY]`
- [ ] Untuk operasi sangat kritis, gunakan token acak per-request (bukan per-session) `[PAY]` `[RACE]`
- [ ] Set atribut "secure" pada cookie yang ditransmisikan melalui TLS
- [ ] Set atribut HttpOnly pada cookie kecuali memang perlu diakses client-side script

---

## 5. Access Control

- [ ] Gunakan objek trusted system (server-side) untuk keputusan otorisasi
- [ ] Gunakan satu komponen site-wide untuk memeriksa otorisasi
- [ ] Kontrol akses harus fail securely
- [ ] Tolak semua akses jika aplikasi tidak bisa membaca konfigurasi keamanan
- [ ] Terapkan kontrol otorisasi pada setiap request `[PAY]`
- [ ] Pisahkan logika privileged dari kode aplikasi lainnya
- [ ] Batasi akses ke file/resource hanya untuk user yang berwenang
- [ ] Batasi akses ke URL yang dilindungi hanya untuk user yang berwenang
- [ ] Batasi akses ke fungsi yang dilindungi hanya untuk user yang berwenang
- [ ] Batasi referensi objek langsung hanya untuk user yang berwenang
- [ ] Batasi akses ke layanan hanya untuk user yang berwenang
- [ ] Batasi akses ke data aplikasi hanya untuk user yang berwenang
- [ ] Batasi akses ke atribut user, data, dan informasi kebijakan akses kontrol
- [ ] Batasi akses ke konfigurasi keamanan hanya untuk user yang berwenang
- [ ] Implementasi server-side dan presentasi layer harus konsisten
- [ ] Jika state data disimpan di client, gunakan enkripsi + integrity check di server `[RACE]`
- [ ] Terapkan alur logika aplikasi sesuai aturan bisnis `[PAY]` `[RACE]`
- [ ] **Batasi jumlah transaksi yang bisa dilakukan satu user/device dalam periode tertentu** `[PAY]` `[RACE]`
- [ ] Jangan gunakan header "referer" sebagai satu-satunya pengecekan otorisasi
- [ ] Untuk session panjang, validasi ulang otorisasi user secara berkala
- [ ] Implementasikan audit akun dan nonaktifkan akun yang tidak digunakan
- [ ] Aplikasi harus mendukung penonaktifan akun dan terminasi session
- [ ] Service account harus memiliki privilege seminimal mungkin

---

## 6. Cryptographic Practices

- [ ] Semua fungsi kriptografi diimplementasikan di trusted system
- [ ] Lindungi secrets dari akses tidak sah
- [ ] Modul kriptografi harus fail securely
- [ ] Semua angka acak, nama file acak, GUID, dan string acak menggunakan RNG yang disetujui modul kriptografi
- [ ] Modul kriptografi harus sesuai standar FIPS 140-2 atau setara
- [ ] Tetapkan kebijakan dan proses pengelolaan kunci kriptografi `[PAY]`

---

## 7. Error Handling & Logging

- [ ] Jangan tampilkan informasi sensitif di response error (detail sistem, session ID, info akun)
- [ ] Gunakan error handler yang tidak menampilkan debugging/stack trace
- [ ] Gunakan pesan error generik dan halaman error kustom
- [ ] Aplikasi harus menangani error sendiri, bukan bergantung pada konfigurasi server
- [ ] Bebaskan memori yang dialokasikan saat kondisi error terjadi
- [ ] Logika error handling untuk kontrol keamanan harus deny by default
- [ ] Semua kontrol logging diimplementasikan di trusted system
- [ ] Logging harus mendukung pencatatan sukses dan gagal untuk event keamanan
- [ ] Pastikan log mengandung data event penting
- [ ] Batasi akses log hanya untuk individu yang berwenang
- [ ] Gunakan satu routine terpusat untuk semua operasi logging
- [ ] Jangan simpan informasi sensitif di log (password, session ID, dll)
- [ ] Log semua kegagalan validasi input
- [ ] **Log semua percobaan autentikasi, terutama yang gagal** `[PAY]`
- [ ] **Log semua kegagalan akses kontrol** `[PAY]`
- [ ] **Log semua event tampering, termasuk perubahan state data yang tidak terduga** `[RACE]` `[PAY]`
- [ ] Log percobaan koneksi dengan token session tidak valid/kedaluwarsa `[PAY]`
- [ ] Log semua exception sistem
- [ ] Log semua fungsi administratif
- [ ] Log semua kegagalan koneksi TLS backend
- [ ] Log semua kegagalan modul kriptografi
- [ ] Gunakan hash kriptografi untuk memvalidasi integritas log entry

---

## 8. Data Protection

- [ ] Implementasikan least privilege
- [ ] Lindungi semua salinan cache atau temporary dari data sensitif di server
- [ ] Enkripsi informasi sensitif yang disimpan, seperti data verifikasi autentikasi `[PAY]`
- [ ] Lindungi source code server-side dari download oleh user
- [ ] Jangan simpan password, connection string, atau info sensitif dalam cleartext di client
- [ ] Hapus komentar di kode production yang dapat mengungkap informasi backend
- [ ] Hapus dokumentasi aplikasi/sistem yang tidak perlu
- [ ] **Jangan masukkan informasi sensitif ke parameter HTTP GET** `[PAY]`
- [ ] Nonaktifkan autocomplete pada form yang mengandung informasi sensitif
- [ ] Nonaktifkan client-side caching di halaman yang mengandung informasi sensitif `[PAY]`
- [ ] Aplikasi harus mendukung penghapusan data sensitif saat tidak lagi diperlukan
- [ ] Terapkan akses kontrol untuk data sensitif yang disimpan di server

---

## 9. Communication Security

- [ ] Implementasikan enkripsi untuk semua transmisi informasi sensitif (gunakan TLS) `[PAY]`
- [ ] Sertifikat TLS harus valid, nama domain benar, belum expired, dan terinstall dengan benar
- [ ] Koneksi TLS yang gagal tidak boleh fallback ke koneksi tidak aman `[PAY]`
- [ ] Gunakan TLS untuk semua konten yang memerlukan authenticated access
- [ ] Gunakan TLS untuk koneksi ke sistem eksternal yang menyangkut data sensitif `[PAY]`
- [ ] Gunakan satu implementasi TLS standar yang dikonfigurasi dengan benar
- [ ] Tentukan character encoding untuk semua koneksi
- [ ] Filter parameter sensitif dari HTTP referer saat linking ke situs eksternal

---

## 10. System Configuration

- [ ] Pastikan server, framework, dan komponen sistem berjalan pada versi terbaru yang disetujui
- [ ] Pastikan semua patch telah diterapkan
- [ ] Nonaktifkan directory listing
- [ ] Batasi privilege web server, process, dan service account seminimal mungkin
- [ ] Saat exception terjadi, fail securely
- [ ] Hapus semua fungsionalitas dan file yang tidak perlu
- [ ] Hapus test code atau fungsionalitas yang tidak ditujukan untuk production sebelum deployment
- [ ] Cegah pengungkapan struktur direktori di file robots.txt
- [ ] Tentukan HTTP method (GET/POST) yang didukung aplikasi
- [ ] Nonaktifkan HTTP method yang tidak diperlukan
- [ ] Hapus informasi tidak perlu dari HTTP response header (OS, versi web server, framework)
- [ ] Konfigurasi keamanan harus bisa dioutput dalam format human-readable untuk audit
- [ ] Implementasikan sistem manajemen aset
- [ ] Isolasi environment development dari production network
- [ ] Implementasikan sistem kontrol perubahan software

---

## 11. Database Security

- [ ] Gunakan strongly typed parameterized query (prepared statements) `[PAY]`
- [ ] Gunakan input validation dan output encoding untuk meta characters di query database
- [ ] Pastikan variabel strongly typed
- [ ] Gunakan level privilege terendah saat mengakses database `[PAY]`
- [ ] Gunakan credential yang aman untuk akses database
- [ ] **Connection string tidak boleh hard-coded dalam aplikasi; simpan terenkripsi di konfigurasi terpisah** `[PAY]`
- [ ] Gunakan stored procedure untuk abstraksi akses data jika memungkinkan
- [ ] Tutup koneksi database segera setelah selesai digunakan `[RACE]`
- [ ] Ubah atau hapus semua password administratif database default
- [ ] Nonaktifkan semua fungsionalitas database yang tidak diperlukan
- [ ] Hapus konten default vendor yang tidak perlu
- [ ] Nonaktifkan akun default yang tidak diperlukan
- [ ] Gunakan credential berbeda untuk setiap tingkat kepercayaan akses database

---

## 12. File Management

- [ ] Jangan teruskan data user langsung ke fungsi dynamic include
- [ ] Wajibkan autentikasi sebelum mengizinkan upload file
- [ ] Batasi jenis file yang bisa diupload sesuai kebutuhan bisnis
- [ ] Validasi tipe file upload melalui file header, bukan hanya ekstensi
- [ ] Jangan simpan file upload di direktori yang sama dengan konteks web aplikasi
- [ ] Cegah atau batasi upload file yang bisa diinterpretasikan oleh web server
- [ ] Nonaktifkan eksekusi di direktori upload file
- [ ] Gunakan allow-list untuk nama dan tipe file yang diizinkan saat mereferensikan file
- [ ] Jangan teruskan data user ke redirect dinamis
- [ ] Jangan gunakan path direktori/file langsung dari user; gunakan index ke daftar path yang sudah ditentukan
- [ ] Jangan pernah kirim path file absolut ke client
- [ ] Pastikan file dan resource aplikasi bersifat read-only
- [ ] Scan file yang diupload user untuk virus dan malware

---

## 13. Memory Management

- [ ] Gunakan kontrol input dan output untuk data untrusted
- [ ] Periksa bahwa buffer sesuai ukuran yang ditentukan
- [ ] Pastikan NULL termination ditangani dengan benar
- [ ] Periksa batas buffer dalam loop untuk mencegah overflow
- [ ] Truncate semua string input ke panjang yang wajar sebelum diteruskan ke fungsi lain
- [ ] Tutup resource secara eksplisit, jangan bergantung pada garbage collection
- [ ] Hindari penggunaan fungsi yang diketahui memiliki kerentanan
- [ ] Bebaskan memori yang dialokasikan setelah fungsi selesai dan di semua exit point
- [ ] Timpa informasi sensitif yang tersimpan di memori di semua exit point

---

## 14. General Coding Practices

- [ ] Gunakan managed code yang sudah teruji untuk tugas umum
- [ ] Gunakan API bawaan untuk tugas OS; jangan izinkan aplikasi mengeluarkan perintah langsung ke OS
- [ ] Gunakan checksum atau hash untuk memverifikasi integritas library, executable, dan file konfigurasi
- [ ] **Gunakan locking untuk mencegah multiple request simultan, atau gunakan mekanisme sinkronisasi untuk mencegah race condition** `[RACE]` `[PAY]`
- [ ] **Lindungi shared variable dan resource dari concurrent access yang tidak tepat** `[RACE]` `[PAY]`
- [ ] Inisialisasi semua variabel dan data store secara eksplisit
- [ ] Jika aplikasi harus berjalan dengan elevated privilege, naikkan privilege selambat mungkin dan turunkan sesegera mungkin
- [ ] Hindari calculation error dengan memahami representasi tipe data di bahasa pemrograman
- [ ] Jangan teruskan data user ke fungsi eksekusi dinamis
- [ ] Batasi user dari membuat kode baru atau mengubah kode yang ada
- [ ] Review semua aplikasi sekunder, kode pihak ketiga, dan library
- [ ] Implementasikan safe updating menggunakan encrypted channel

---

## 🚨 Ringkasan Item Kritis: Race Condition & Payment Gateway

### ⚡ Race Condition `[RACE]`

Ini yang paling sering luput dan bisa dieksploitasi untuk double-spend atau duplikasi transaksi:

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

## 📌 Cara Penggunaan

1. Copy file ini ke root repository project kamu
2. Tandai item dengan `[x]` setelah selesai diimplementasikan
3. Item `[RACE]` dan `[PAY]` prioritaskan lebih dulu jika project kamu ada payment
4. Jadikan checklist ini bagian dari code review sebelum deployment ke production

---

> Sumber: [OWASP Secure Coding Practices Quick Reference Guide](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)  
> Versi ini ditambahkan label kontekstual `[RACE]` dan `[PAY]` untuk kemudahan penggunaan.
