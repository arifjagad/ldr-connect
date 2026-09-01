"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
import type { AuthUser } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const supabase = createClient();

    // 1. Sign up via Supabase Auth
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (signUpError) {
      const msg = signUpError.message.includes("already registered")
        ? "Email ini sudah terdaftar"
        : signUpError.message;
      toast.error("Registrasi Gagal", msg);
      setLoading(false);
      return;
    }

    // 2. Fetch profile
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const json = await res.json();
      setUser(json.data as AuthUser);
    }

    toast.success("Akun Berhasil Dibuat", "Selamat datang di LDR-Connect!");
    router.push("/dashboard");
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
              Create Account
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#78716C]">
              Daftar gratis dan mulai hubungkan akun kalian dalam 2 menit.
            </p>
          </div>

          {/* Form */}
          <form className="mt-8 space-y-4 text-left" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Nama Kamu
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-xs text-[#1F1D1B] placeholder-[#A8A29E] outline-none transition focus:border-[#C84B31] focus:bg-white"
                placeholder="Nama panggilan"
              />
            </div>

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
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-xs text-[#1F1D1B] placeholder-[#A8A29E] outline-none transition focus:border-[#C84B31] focus:bg-white"
                placeholder="Minimal 6 karakter"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-[#C84B31] px-4 py-3 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Memproses..." : "Daftar Sekarang"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-[#78716C]">
            Sudah punya akun?{" "}
            <Link
              className="font-semibold text-[#C84B31] transition-colors hover:underline"
              href="/auth/login"
            >
              Masuk di sini
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
