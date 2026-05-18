"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { PushNotificationToggle } from "@/components/ui/PushNotificationToggle";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Name update state
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
    setAvatarMsg(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/user/avatar", { method: "POST", body: form });
    const json = await res.json();

    if (json.success) {
      setUser({ ...user!, avatar_url: json.data.avatar_url });
      setAvatarMsg({ ok: true, text: "Foto profil diperbarui!" });
    } else {
      setAvatarPreview(user?.avatar_url ?? null); // revert preview
      setAvatarMsg({ ok: false, text: json.message });
    }
    setAvatarLoading(false);
  }

  async function handleRemoveAvatar() {
    setAvatarLoading(true);
    const res = await fetch("/api/user/avatar", { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setAvatarPreview(null);
      setUser({ ...user!, avatar_url: null });
      setAvatarMsg({ ok: true, text: "Foto profil dihapus" });
    }
    setAvatarLoading(false);
  }

  // ── Update name ──────────────────────────────────────────────────────────

  async function handleUpdateName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === user?.name) return;
    setNameLoading(true);
    setNameMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ name: name.trim() })
      .eq("id", user!.id);

    if (error) {
      setNameMsg({ ok: false, text: error.message });
    } else {
      setUser({ ...user!, name: name.trim() });
      setNameMsg({ ok: true, text: "Nama berhasil diperbarui!" });
    }
    setNameLoading(false);
  }

  // ── Change password ──────────────────────────────────────────────────────

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassMsg({ ok: false, text: "Konfirmasi password tidak cocok" });
      return;
    }
    if (newPassword.length < 8) {
      setPassMsg({ ok: false, text: "Password minimal 8 karakter" });
      return;
    }
    setPassLoading(true);
    setPassMsg(null);

    const supabase = createClient();

    // Re-authenticate terlebih dahulu untuk verifikasi current password
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) {
      setPassMsg({ ok: false, text: "Gagal verifikasi sesi. Coba logout dan login kembali." });
      setPassLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword,
    });
    if (signInError) {
      setPassMsg({ ok: false, text: "Password saat ini salah" });
      setPassLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPassMsg({ ok: false, text: error.message });
    } else {
      setPassMsg({ ok: true, text: "Password berhasil diubah!" });
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
    <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full blur-[100px]"
        style={{ background: "radial-gradient(ellipse, rgba(255,61,127,0.08) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Profil</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#FFF5F8]">
          Profil &{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #FF3D7F, #818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Pengaturan
          </span>
        </h1>
      </div>

      <div className="space-y-5">

        {/* ── Account Info Card ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#5C5470]">Info Akun</p>
          <div className="flex items-start gap-5">

            {/* Clickable Avatar */}
            <div className="relative shrink-0 group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="relative h-16 w-16 overflow-hidden rounded-2xl ring-2 ring-white/10 transition hover:ring-[#FF3D7F]/40 focus:outline-none"
                title="Ganti foto profil"
              >
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Avatar"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF3D7F]/30 to-[#818CF8]/30 text-2xl font-bold text-[#FFF5F8]">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                )}
                {/* Camera overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                  {avatarLoading ? (
                    <svg className="animate-spin text-white" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
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
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0E0E12] border border-white/20 text-[#5C5470] transition hover:border-red-500/40 hover:text-red-400"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
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
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-[#FFF5F8]">{user?.name}</p>
                {user?.is_admin && (
                  <span className="rounded-full bg-[#F472B6]/15 px-2 py-0.5 text-[10px] font-bold text-[#F472B6]">Admin</span>
                )}
              </div>
              <p className="text-sm text-[#9B93B0]">{user?.email}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="flex items-center gap-1.5 text-xs text-[#5C5470]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                  </svg>
                  Bergabung {joinedDate}
                </span>
                <span className={`flex items-center gap-1.5 text-xs ${user?.status === "linked" ? "text-[#34D399]" : "text-[#5C5470]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${user?.status === "linked" ? "bg-[#34D399] shadow-[0_0_6px_#34D399]" : "bg-[#5C5470]"}`} />
                  {user?.status === "linked" ? "Terhubung dengan partner" : "Belum ada partner"}
                </span>
                {lastSignIn && (
                  <span className="flex items-center gap-1.5 text-xs text-[#5C5470]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" strokeLinecap="round" />
                    </svg>
                    Login terakhir: {lastSignIn}
                  </span>
                )}
              </div>
              {/* Avatar message */}
              {avatarMsg && (
                <p className={`text-xs pt-0.5 ${avatarMsg.ok ? "text-[#34D399]" : "text-red-400"}`}>
                  {avatarMsg.text}
                </p>
              )}
              <p className="text-[10px] text-[#3a3650] pt-0.5">Klik foto untuk menggantinya · Maks. 3MB</p>
            </div>
          </div>
        </div>

        {/* ── Edit Name ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#5C5470]">Ubah Nama</p>
          <form onSubmit={handleUpdateName} className="space-y-3">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-medium text-[#9B93B0] mb-1.5">
                Nama Tampilan
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={50}
                className="w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#FF3D7F]/40 focus:ring-1 focus:ring-[#FF3D7F]/20 transition"
                placeholder="Nama kamu"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9B93B0] mb-1.5">Email</label>
              <input
                value={user?.email ?? ""}
                readOnly
                className="w-full rounded-xl border border-white/[0.07] bg-[#0E0E12] px-4 py-2.5 text-sm text-[#5C5470] cursor-not-allowed"
              />
              <p className="mt-1 text-[10px] text-[#5C5470]">Email tidak bisa diubah</p>
            </div>
            <button
              type="submit"
              disabled={nameLoading || !name.trim() || name.trim() === user?.name}
              className="flex items-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.25)] transition hover:bg-[#FF6B9D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {nameLoading ? (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              ) : null}
              {nameLoading ? "Menyimpan..." : "Simpan Nama"}
            </button>
            {nameMsg && (
              <p className={`text-xs ${nameMsg.ok ? "text-[#34D399]" : "text-red-400"}`}>{nameMsg.text}</p>
            )}
          </form>
        </div>

        {/* ── Change Password ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#5C5470]">Ganti Password</p>
          <form onSubmit={handleChangePassword} className="space-y-3">
            {/* Current password */}
            <div>
              <label htmlFor="current-pass" className="block text-xs font-medium text-[#9B93B0] mb-1.5">
                Password Saat Ini
              </label>
              <div className="relative">
                <input
                  id="current-pass"
                  type={showPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 pr-10 text-sm text-[#FFF5F8] outline-none focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20 transition"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5470] hover:text-[#9B93B0]">
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
              <label htmlFor="new-pass" className="block text-xs font-medium text-[#9B93B0] mb-1.5">
                Password Baru <span className="text-[#5C5470]">(min. 8 karakter)</span>
              </label>
              <input
                id="new-pass"
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20 transition"
                placeholder="••••••••"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm-pass" className="block text-xs font-medium text-[#9B93B0] mb-1.5">
                Konfirmasi Password Baru
              </label>
              <input
                id="confirm-pass"
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`w-full rounded-xl border bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none transition ${
                  confirmPassword && newPassword !== confirmPassword
                    ? "border-red-500/40 focus:border-red-500/60"
                    : "border-white/10 focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20"
                }`}
                placeholder="••••••••"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-[10px] text-red-400">Password tidak cocok</p>
              )}
            </div>

            <button
              type="submit"
              disabled={passLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="flex items-center gap-2 rounded-xl bg-[#818CF8] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(129,140,248,0.25)] transition hover:bg-[#A78BFA] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {passLoading ? (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              ) : null}
              {passLoading ? "Mengubah..." : "Ubah Password"}
            </button>

            {passMsg && (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                passMsg.ok
                  ? "border-[#34D399]/20 bg-[#34D399]/10 text-[#34D399]"
                  : "border-red-500/20 bg-red-500/10 text-red-300"
              }`}>
                {passMsg.ok
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                }
                {passMsg.text}
              </div>
            )}
          </form>
        </div>

        {/* ── Notifikasi Push ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#5C5470]">Notifikasi</p>
          <PushNotificationToggle />
          <p className="mt-3 text-[11px] text-[#5C5470]">
            Aktifkan agar kamu dapat notifikasi saat partner join game — bahkan saat tab ditutup.
          </p>
        </div>

        {/* ── Couple Code ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#FF3D7F]/15 bg-linear-to-br from-[#FF3D7F]/5 to-transparent p-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#5C5470]">Couple Code Kamu</p>
          <p className="font-mono text-2xl font-bold tracking-[0.15em] text-[#FF6B9D]">
            {user?.couple_code ?? "—"}
          </p>
          <p className="mt-2 text-xs text-[#9B93B0]">
            Bagikan kode ini ke pasanganmu agar bisa terhubung.
          </p>
        </div>

      </div>
    </main>
  );
}
