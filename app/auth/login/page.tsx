"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
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

    // 1. Login via server-side route
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
    <div className="flex min-h-screen flex-col bg-[#FCFBF7] text-[#1F1D1B]">
      {/* Mini Header / Brand */}
      <header className="border-b border-[#E7E5E4] bg-[#FCFBF7] px-6 py-4 sm:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#C84B31] text-xs font-bold text-white">
              ♥
            </div>
            <span className="text-base font-bold tracking-tight text-[#1F1D1B]">
              LDR-Connect
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-[#78716C] transition-colors hover:text-[#1F1D1B]"
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#E7E5E4] bg-white p-8 shadow-xl shadow-black/[0.03] sm:p-10">
          {/* Card Header */}
          <div className="text-center">
            <div className="inline-flex items-center rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1">
              <span className="text-[10px] font-semibold tracking-wider text-[#C84B31] uppercase">
                LDR-Connect
              </span>
            </div>
            <h1 className="font-editorial mt-3 text-3xl font-normal tracking-tight text-[#1F1D1B] sm:text-4xl">
              Welcome Back
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#78716C]">
              Masuk untuk bermain dan terhubung dengan pasanganmu.
            </p>
          </div>

          {/* Form */}
          <form className="mt-8 space-y-4 text-left" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-xs text-[#1F1D1B] placeholder-[#A8A29E] outline-none transition focus:border-[#C84B31] focus:bg-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-xs text-[#1F1D1B] placeholder-[#A8A29E] outline-none transition focus:border-[#C84B31] focus:bg-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-[#C84B31] px-4 py-3 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Memproses..." : "Masuk Sekarang"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-[#78716C]">
            Belum punya akun?{" "}
            <Link
              className="font-semibold text-[#C84B31] transition-colors hover:underline"
              href="/auth/register"
            >
              Daftar di sini
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
