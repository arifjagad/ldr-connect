# Figma Design Migration Checklist

Dokumen pelacakan pembuatan frame desain Figma untuk semua layout aplikasi LDR-Connect menggunakan Editorial Design System.

---

## 📌 Status Ringkasan
- **Total Halaman Teridentifikasi**: 17 Halaman
- **Selesai di Figma**: 9 Halaman
- **Dalam Pengerjaan / Belum**: 8 Halaman
- **Status API Figma**: Starter Plan Rate Limit tercapai saat generate `ldr-connect-time-capsule`. Frame sebelumnya (`17:33`, `17:149`, `16:290`, `16:137`, `16:36`, `15:2`, `12:34`, `11:13`, `5:4`) sudah terbuat.

---

## 📋 Daftar Layout & Checklist Pembuatan di Figma

### 1. Public & Auth (Selesai)
- [x] **Landing Page** (`app/page.tsx`) — Node ID: `5:4` (`ldr-connect-landing-page`)
- [x] **Login Page** (`app/auth/login/page.tsx`) — Node ID: `11:13` (`ldr-connect-auth-login`)
- [x] **Register Page** (`app/auth/register/page.tsx`) — Terintegrasi dengan flow Auth

### 2. User Dashboard Core (Selesai)
- [x] **User Dashboard Overview** (`app/dashboard/page.tsx`) — Node ID: `12:34` (`ldr-connect-user-dashboard`)
- [x] **Games Hub / List** (`app/dashboard/games/page.tsx`) — Node ID: `15:2` (`ldr-connect-games-hub`)
- [x] **Couple Connection Page** (`app/dashboard/couple/page.tsx`) — Node ID: `16:36` (`ldr-connect-couple-connection`)
- [x] **Coin Topup & Balance** (`app/dashboard/coin/page.tsx`) — Node ID: `16:137` (`ldr-connect-coin-topup`)
- [x] **Profile Settings** (`app/dashboard/profile/page.tsx`) — Node ID: `16:290` (`ldr-connect-profile-settings`)

### 3. Features & Momen (Sebagian Selesai)
- [x] **Anniversaries Tracker** (`app/dashboard/anniversaries/page.tsx`) — Node ID: `17:33` (`ldr-connect-anniversaries`)
- [x] **Wishlist** (`app/dashboard/wishlist/page.tsx`) — Node ID: `17:149` (`ldr-connect-wishlist`)
- [ ] **Time Capsule** (`app/dashboard/capsule/page.tsx`) — *Pending rate-limit reset*

### 4. Game Rooms (Belum)
- [ ] **Truth or Dare (ToD) Room** (`app/dashboard/games/tod/page.tsx`)
- [ ] **Snake & Ladder Room** (`app/dashboard/games/snake-ladder/page.tsx`)
- [ ] **Dare Derby Room** (`app/dashboard/games/dare-derby/page.tsx`)
- [ ] **Quoridor Room** (`app/dashboard/games/quoridor/page.tsx`)
- [ ] **Game Stats & History** (`app/dashboard/games/stats/page.tsx` & `history/page.tsx`)

### 5. Admin Panel (Belum)
- [ ] **Admin Dashboard Overview** (`app/admin/dashboard/page.tsx`)
- [ ] **Admin Users Management** (`app/admin/users/page.tsx`)
- [ ] **Admin Questions Moderation** (`app/admin/questions/page.tsx`)
- [ ] **Admin Transactions & Vouchers** (`app/admin/transactions/page.tsx` & `vouchers/page.tsx`)

---

## 🎯 Detail Frame Terdaftar di Figma Canvas:
1. `x: 0, y: 0` → `ldr-connect-landing-page` (`5:4`)
2. `x: 1600, y: 0` → `ldr-connect-auth-login` (`11:13`)
3. `x: 3200, y: 0` → `ldr-connect-user-dashboard` (`12:34`)
4. `x: 4800, y: 0` → `ldr-connect-games-hub` (`15:2`)
5. `x: 6400, y: 0` → `ldr-connect-couple-connection` (`16:36`)
6. `x: 8000, y: 0` → `ldr-connect-coin-topup` (`16:137`)
7. `x: 9600, y: 0` → `ldr-connect-profile-settings` (`16:290`)
8. `x: 11200, y: 0` → `ldr-connect-anniversaries` (`17:33`)
9. `x: 12800, y: 0` → `ldr-connect-wishlist` (`17:149`)
