"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
import { Logo } from "@/components/ui/Logo";
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
    // name dikirim lewat options.data → masuk ke raw_user_meta_data
    // Trigger handle_new_auth_user() akan membuat profile + wallet otomatis
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

    // 2. Fetch profile (tunggu sebentar agar trigger selesai)
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

      {/* Main Register Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[460px]">
          <div className="rounded-3xl border border-white/10 bg-[#111113] p-8 sm:p-10 shadow-2xl">
            {/* Header Badge & Title */}
            <div className="text-center">
              <span className="inline-block rounded-full border border-[#FF3D7F]/30 bg-[#FF3D7F]/10 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6B9D]">
                LDR-CONNECT
              </span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#FFF5F8]">
                Create Account
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#9B93B0]">
                Daftar sekarang untuk mulai bermain dengan pasanganmu.
              </p>
            </div>

            {/* Form */}
            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <div>
                <label className="block text-xs font-semibold text-[#FFF5F8]">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-3.5 text-sm text-[#FFF5F8] placeholder-[#5C5470] outline-none transition focus:border-[#FF3D7F] focus:ring-1 focus:ring-[#FF3D7F]"
                  placeholder="Nama kamu"
                />
              </div>

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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-3.5 text-sm text-[#FFF5F8] placeholder-[#5C5470] outline-none transition focus:border-[#FF3D7F] focus:ring-1 focus:ring-[#FF3D7F]"
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#FF3D7F] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF3D7F]/20 transition-all hover:bg-[#FF6B9D] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Memproses..." : "Daftar Sekarang"}
              </button>
            </form>

            {/* Footer text */}
            <p className="mt-6 text-center text-xs text-[#9B93B0]">
              Sudah punya akun?{" "}
              <Link
                href="/auth/login"
                className="font-bold text-[#FF6B9D] transition-colors hover:text-[#FF3D7F]"
              >
                Masuk di sini
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
