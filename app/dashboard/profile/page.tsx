"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";
import { PushNotificationToggle } from "@/components/ui/PushNotificationToggle";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Name update state
  const [nameLoading, setNameLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.avatar_url) setAvatarPreview(user.avatar_url);
  }, [user?.name, user?.avatar_url]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser?.last_sign_in_at) {
        setLastSignIn(
          new Date(authUser.last_sign_in_at).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
          })
        );
      }
    });
  }, []);

  // ── Upload avatar ────────────────────────────────────────────────────────

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setAvatarLoading(true);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/user/avatar", { method: "POST", body: form });
    const json = await res.json();

    if (json.success) {
      setUser({ ...user!, avatar_url: json.data.avatar_url });
      toast.success("Foto Profil Diperbarui!", "Foto profil kamu berhasil diunggah.");
    } else {
      setAvatarPreview(user?.avatar_url ?? null); // revert preview
      toast.error("Gagal Mengunggah Foto", json.message || "Terjadi kesalahan saat mengunggah foto.");
    }
    setAvatarLoading(false);
  }

  async function handleRemoveAvatar() {
    const confirmed = await dialog.confirm({
      title: "Hapus Foto Profil?",
      description: "Apakah kamu yakin ingin menghapus foto profil dan kembali ke inisial nama?",
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
      isDanger: true,
    });
    if (!confirmed) return;

    setAvatarLoading(true);
    const res = await fetch("/api/user/avatar", { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setAvatarPreview(null);
      setUser({ ...user!, avatar_url: null });
      toast.info("Foto Profil Dihapus", "Foto profil telah dikembalikan ke inisial.");
    } else {
      toast.error("Gagal Menghapus Foto", json.message || "Terjadi kesalahan saat menghapus foto.");
    }
    setAvatarLoading(false);
  }

  // ── Update name ──────────────────────────────────────────────────────────

  async function handleUpdateName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === user?.name) return;
    setNameLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ name: name.trim() })
      .eq("id", user!.id);

    if (error) {
      toast.error("Gagal Memperbarui Nama", error.message);
    } else {
      setUser({ ...user!, name: name.trim() });
      toast.success("Nama Berhasil Diperbarui!", "Nama tampilan kamu berhasil disimpan.");
    }
    setNameLoading(false);
  }

  // ── Change password ──────────────────────────────────────────────────────

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Password Tidak Cocok", "Konfirmasi password baru tidak sesuai.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password Kurang Panjang", "Password baru harus memiliki minimal 8 karakter.");
      return;
    }
    setPassLoading(true);

    const supabase = createClient();

    // Re-authenticate terlebih dahulu untuk verifikasi current password
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) {
      toast.error("Sesi Tidak Ditemukan", "Gagal verifikasi sesi. Silakan coba login ulang.");
      setPassLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword,
    });
    if (signInError) {
      toast.error("Password Salah", "Password saat ini yang kamu masukkan salah.");
      setPassLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Gagal Mengubah Password", error.message);
    } else {
      toast.success("Password Diperbarui!", "Password akun berhasil diubah. Gunakan password baru untuk login berikutnya.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPassLoading(false);
  }

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          <span>👤</span>
          <span>Pengaturan Akun</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
          Profil & Pengaturan
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#78716C]">
          Kelola informasi akun, foto profil, keamanan password, dan preferensi notifikasi.
        </p>
      </div>

      <div className="space-y-6">

        {/* ── Account Info Card ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Info Profil</p>
          <div className="flex flex-col sm:flex-row items-start gap-5">

            {/* Clickable Avatar */}
            <div className="relative shrink-0 group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="relative h-20 w-20 overflow-hidden rounded-2xl ring-2 ring-[#E7E5E4] transition hover:ring-[#C84B31] focus:outline-none cursor-pointer"
                title="Ganti foto profil"
              >
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Avatar"
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#FDF4F2] font-serif text-3xl font-bold text-[#C84B31]">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                )}
                {/* Camera overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  {avatarLoading ? (
                    <svg className="animate-spin text-white" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Remove button (only show if has avatar) */}
              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarLoading}
                  title="Hapus foto profil"
                  className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#E7E5E4] text-[#78716C] shadow-xs transition hover:border-red-300 hover:text-red-600 cursor-pointer"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <p className="text-lg font-bold text-[#1F1D1B]">{user?.name}</p>
                {user?.is_admin && (
                  <span className="rounded-full border border-[#C84B31]/20 bg-[#FDF4F2] px-2.5 py-0.5 text-[10px] font-bold text-[#C84B31]">Admin</span>
                )}
              </div>
              <p className="text-xs text-[#78716C]">{user?.email}</p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="flex items-center gap-1.5 text-xs text-[#78716C]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                  </svg>
                  Bergabung {joinedDate}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                  user?.status === "linked" ? "border-[#10B981]/20 bg-[#EBF9EB] text-[#10B981]" : "border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C]"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${user?.status === "linked" ? "bg-[#10B981]" : "bg-[#A8A29E]"}`} />
                  {user?.status === "linked" ? "Terhubung dengan partner" : "Belum ada partner"}
                </span>
                {lastSignIn && (
                  <span className="flex items-center gap-1.5 text-xs text-[#78716C]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" strokeLinecap="round" />
                    </svg>
                    Login terakhir: {lastSignIn}
                  </span>
                )}
              </div>
              {/* Avatar message */}
              <p className="text-[11px] text-[#A8A29E] pt-1">Klik foto untuk mengganti avatar · Maksimal ukuran file 3MB</p>
            </div>
          </div>
        </div>

        {/* ── Edit Name ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Ubah Nama</p>
          <form onSubmit={handleUpdateName} className="space-y-4 max-w-xl">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">
                Nama Tampilan
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={50}
                className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs font-medium text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                placeholder="Nama kamu"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">Alamat Email</label>
              <input
                value={user?.email ?? ""}
                readOnly
                className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs text-[#78716C] cursor-not-allowed opacity-75"
              />
              <p className="mt-1 text-[10px] text-[#A8A29E]">Email terdaftar tidak dapat diubah.</p>
            </div>
            <button
              type="submit"
              disabled={nameLoading || !name.trim() || name.trim() === user?.name}
              className="flex items-center gap-2 rounded-xl bg-[#C84B31] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {nameLoading ? (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              ) : null}
              {nameLoading ? "Menyimpan..." : "Simpan Nama"}
            </button>
          </form>
        </div>

        {/* ── Change Password ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Ganti Password</p>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            {/* Current password */}
            <div>
              <label htmlFor="current-pass" className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">
                Password Saat Ini
              </label>
              <div className="relative">
                <input
                  id="current-pass"
                  type={showPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 pr-10 text-xs font-medium text-[#1F1D1B] outline-none focus:border-[#C84B31] focus:bg-white transition"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1F1D1B] cursor-pointer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label htmlFor="new-pass" className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">
                Password Baru <span className="text-[#78716C] font-normal">(min. 8 karakter)</span>
              </label>
              <input
                id="new-pass"
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs font-medium text-[#1F1D1B] outline-none focus:border-[#C84B31] focus:bg-white transition"
                placeholder="••••••••"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm-pass" className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">
                Konfirmasi Password Baru
              </label>
              <input
                id="confirm-pass"
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`w-full rounded-xl border bg-[#FCFBF7] px-4 py-2.5 text-xs font-medium text-[#1F1D1B] outline-none transition ${
                  confirmPassword && newPassword !== confirmPassword
                    ? "border-red-300 focus:border-red-500"
                    : "border-[#E7E5E4] focus:border-[#C84B31] focus:bg-white"
                }`}
                placeholder="••••••••"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-[11px] font-medium text-red-600">Konfirmasi password tidak cocok</p>
              )}
            </div>

            <button
              type="submit"
              disabled={passLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="flex items-center gap-2 rounded-xl bg-[#1F1D1B] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#383330] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {passLoading ? (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              ) : null}
              {passLoading ? "Mengubah..." : "Ubah Password"}
            </button>
          </form>
        </div>

        {/* ── Notifikasi Push ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Notifikasi Push</p>
          <PushNotificationToggle />
          <p className="mt-3 text-[11px] text-[#78716C]">
            Aktifkan agar kamu mendapat notifikasi instan saat pasangan bergabung ke ruang permainan.
          </p>
        </div>

        {/* ── Couple Code ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Couple Code Kamu</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-[0.2em] text-[#C84B31]">
              {user?.couple_code ?? "—"}
            </p>
            <p className="mt-1 text-xs text-[#78716C]">
              Gunakan kode ini untuk menghubungkan akun pada menu Couple.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
            ♥
          </div>
        </div>

      </div>
    </main>
  );
}
