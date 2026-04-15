"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // 1. Sign in via Supabase Auth
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Email atau password salah"
          : signInError.message
      );
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

    // 3. Redirect berdasarkan role
    const redirectTo = profile?.is_admin ? "/admin/dashboard" : "/dashboard";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <div className="rounded-3xl border border-rose-800/40 bg-[#121420] p-8 shadow-2xl shadow-rose-950/30">
        <p className="mb-2 text-sm uppercase tracking-[0.22em] text-rose-300/70">
          LDR-Connect
        </p>
        <h1 className="mb-6 text-3xl font-bold text-rose-50">Welcome Back</h1>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm text-rose-100/80">
            Email
            <input
              type="email"
              required
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-rose-50 outline-none ring-0 transition focus:border-rose-400"
              placeholder="********"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-rose-500 px-4 py-3 font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="mt-5 text-sm text-rose-100/70">
          Belum punya akun?{" "}
          <Link className="font-semibold text-rose-300 hover:text-rose-200" href="/auth/register">
            Register di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
