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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <div className="rounded-3xl border border-rose-800/40 bg-[#121420] p-8 shadow-2xl shadow-rose-950/30">
        <p className="mb-2 text-sm uppercase tracking-[0.22em] text-rose-300/70">
          LDR-Connect
        </p>
        <h1 className="mb-6 text-3xl font-bold text-rose-50">Create Account</h1>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm text-rose-100/80">
            Nama
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-rose-50 outline-none ring-0 transition focus:border-rose-400"
              placeholder="Nama kamu"
            />
          </label>

          <label className="block text-sm text-rose-100/80">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-rose-50 outline-none ring-0 transition focus:border-rose-400"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-sm text-rose-100/80">
            Password
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-rose-50 outline-none ring-0 transition focus:border-rose-400"
              placeholder="Minimal 6 karakter"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-rose-500 px-4 py-3 font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="mt-5 text-sm text-rose-100/70">
          Sudah punya akun?{" "}
          <Link className="font-semibold text-rose-300 hover:text-rose-200" href="/auth/login">
            Login di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
