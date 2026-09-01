"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
import { Logo } from "@/components/ui/Logo";
import type { AuthUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    // 1. Login via server-side route (includes rate limiting + session age cookie)
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!loginRes.ok) {
      const json = await loginRes.json().catch(() => ({}));
      const msg = json.message || "Login gagal, coba lagi.";
      toast.error("Gagal Masuk", msg);
      setLoading(false);
      return;
    }

    // 2. Fetch profile + wallet untuk disimpan di store
    const res = await fetch("/api/auth/me");
    let profile: AuthUser | null = null;
    if (res.ok) {
      const json = await res.json();
      profile = json.data as AuthUser;
      setUser(profile);
    }

    toast.success("Berhasil Masuk", `Selamat datang kembali, ${profile?.name || "User"}!`);

    // 3. Redirect berdasarkan role
    const redirectTo = profile?.is_admin ? "/admin/dashboard" : "/dashboard";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#FFF5F8] flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="w-full border-b border-white/5 bg-[#0A0A0B]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo href="/" size="md" />

          <Link
            href="/"
            className="text-xs font-medium text-[#9B93B0] transition-colors hover:text-[#FFF5F8]"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[460px]">
          <div className="rounded-3xl border border-white/10 bg-[#111113] p-8 sm:p-10 shadow-2xl">
            {/* Header Badge & Title */}
            <div className="text-center">
              <span className="inline-block rounded-full border border-[#FF3D7F]/30 bg-[#FF3D7F]/10 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6B9D]">
                LDR-CONNECT
              </span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#FFF5F8]">
                Welcome Back
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#9B93B0]">
                Masuk untuk bermain dan terhubung dengan pasanganmu.
              </p>
            </div>

            {/* Form */}
            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <div>
                <label className="block text-xs font-semibold text-[#FFF5F8]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-3.5 text-sm text-[#FFF5F8] placeholder-[#5C5470] outline-none transition focus:border-[#FF3D7F] focus:ring-1 focus:ring-[#FF3D7F]"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#FFF5F8]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-3.5 text-sm text-[#FFF5F8] placeholder-[#5C5470] outline-none transition focus:border-[#FF3D7F] focus:ring-1 focus:ring-[#FF3D7F]"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#FF3D7F] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF3D7F]/20 transition-all hover:bg-[#FF6B9D] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Memproses..." : "Masuk Sekarang"}
              </button>
            </form>

            {/* Footer text */}
            <p className="mt-6 text-center text-xs text-[#9B93B0]">
              Belum punya akun?{" "}
              <Link
                href="/auth/register"
                className="font-bold text-[#FF6B9D] transition-colors hover:text-[#FF3D7F]"
              >
                Daftar di sini
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-6 text-center text-[11px] text-[#5C5470]">
        © {new Date().getFullYear()} LDR-Connect. All rights reserved.
      </footer>
    </div>
  );
}
