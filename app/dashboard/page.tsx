"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser, WalletData, Anniversary } from "@/lib/types";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  target.setFullYear(today.getFullYear());
  if (target < today) target.setFullYear(today.getFullYear() + 1);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D1B] shadow-2xs transition hover:border-[#C84B31] hover:bg-[#FDF4F2] hover:text-[#C84B31]"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Tersalin!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Salin Kode
        </>
      )}
    </button>
  );
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-[#E7E5E4] bg-white p-6 ${className}`}>
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-[#E7E5E4]/60" />
        <div className="h-7 w-32 rounded bg-[#E7E5E4]/80" />
      </div>
    </div>
  );
}

const navItems = [
  {
    href: "/dashboard/games",
    label: "Game Rooms",
    sublabel: "Mainkan bersama pasangan",
    tag: "Populer",
    tagColor: "bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="1.8">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M6 12h4M8 10v4M15 11h2M15 13h2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/coin",
    label: "Saldo Koin",
    sublabel: "Isi ulang saldo instan",
    tag: null,
    tagColor: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v2M12 16v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 5M12 17h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/couple",
    label: "Koneksi Pasangan",
    sublabel: "Kelola status & pasangan",
    tag: null,
    tagColor: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="1.8">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/anniversaries",
    label: "Anniversary Tracker",
    sublabel: "Catat momen berharga",
    tag: null,
    tagColor: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

type ActiveSession = { session_code: string; game_type: string; host_user_id: string; status: string; expires_at: string } | null;

const GAME_LABELS: Record<string, string> = {
  tod:          "Truth or Dare",
  snake_ladder: "Ular Tangga",
  dare_derby:   "Dare Derby",
  quoridor:     "Quoridor",
};

const GAME_ROUTES: Record<string, string> = {
  tod:          "/dashboard/games/tod",
  snake_ladder: "/dashboard/games/snake-ladder",
  dare_derby:   "/dashboard/games/dare-derby",
  quoridor:     "/dashboard/games/quoridor",
};

export default function DashboardPage() {
  const { user, setUser } = useAuthStore();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [partner, setPartner] = useState<AuthUser | null>(null);
  const [coupleCode, setCoupleCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingAnniversaries, setUpcomingAnniversaries] = useState<Anniversary[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession>(null);
  const [hasPlayedGame, setHasPlayedGame] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();

        // Ambil session user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        // Query profile + wallet dalam satu request
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*, wallets(balance, updated_at)")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          setError(
            profileError?.code === "PGRST116"
              ? "Profil belum tersedia. Coba logout lalu login kembali."
              : "Gagal memuat data profil. Coba refresh halaman."
          );
          return;
        }

        const wallets = profile.wallets as { balance: number; updated_at: string } | null;
        const walletBalance = wallets?.balance ?? 0;

        const profileData: AuthUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          couple_code: profile.couple_code,
          partner_id: profile.partner_id,
          status: profile.status,
          is_admin: profile.is_admin ?? false,
          wallet_balance: walletBalance,
          created_at: profile.created_at,
          avatar_url: profile.avatar_url ?? null,
        };

        setUser(profileData);
        setCoupleCode(profile.couple_code ?? "");
        setWallet({
          user_id: profile.id,
          balance: walletBalance,
          updated_at: wallets?.updated_at ?? profile.created_at,
        });

        // Load anniversaries aktif milik pasangan
        const { data: annData } = await supabase
          .from("anniversaries")
          .select("*")
          .eq("is_active", true);

        if (annData) {
          const sorted = (annData as Anniversary[])
            .map((a) => ({ ...a, _days: daysUntil(a.date) }))
            .sort((a, b) => a._days - b._days)
            .slice(0, 3);
          setUpcomingAnniversaries(sorted);
        }

        // Cek active session di semua game
        try {
          const sessionRes = await fetch("/api/game/session/any-active");
          const sessionJson = await sessionRes.json();
          setActiveSession(sessionJson?.data?.session ?? null);
        } catch { /* ignore */ }

        // Cek apakah user sudah pernah main game
        try {
          const { count } = await supabase
            .from("game_sessions")
            .select("id", { count: "exact", head: true })
            .or(`host_user_id.eq.${authUser.id},partner_user_id.eq.${authUser.id}`)
            .in("status", ["completed", "expired", "cancelled"]);
          setHasPlayedGame((count ?? 0) > 0);
        } catch { /* ignore */ }

        // Ambil data partner jika linked
        if (profile.partner_id) {
          const { data: partnerData } = await supabase
            .from("users")
            .select("*, wallets(balance)")
            .eq("id", profile.partner_id)
            .single();

          if (partnerData) {
            const pw = partnerData.wallets as { balance: number } | null;
            setPartner({
              id: partnerData.id,
              name: partnerData.name,
              email: partnerData.email,
              couple_code: partnerData.couple_code,
              partner_id: partnerData.partner_id,
              status: partnerData.status,
              is_admin: partnerData.is_admin ?? false,
              wallet_balance: pw?.balance ?? 0,
              created_at: partnerData.created_at,
              avatar_url: partnerData.avatar_url ?? null,
            });
          }
        }
      } catch {
        setError("Gagal memuat data. Coba refresh halaman.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [setUser]);

  // Realtime: update banner saat status sesi berubah
  useEffect(() => {
    if (!activeSession) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-session-${activeSession.session_code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `session_code=eq.${activeSession.session_code}` },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          if (["expired", "cancelled", "completed"].includes(newStatus)) {
            setActiveSession(null);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession?.session_code]);

  // Timer: hapus banner saat join window habis (status waiting)
  useEffect(() => {
    if (!activeSession?.expires_at || activeSession.status !== "waiting") return;
    const msLeft = new Date(activeSession.expires_at).getTime() - Date.now();
    if (msLeft <= 0) { setActiveSession(null); return; }
    const id = setTimeout(() => setActiveSession(null), msLeft);
    return () => clearTimeout(id);
  }, [activeSession?.expires_at, activeSession?.status]);

  const isLinked = user?.status === "linked";

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <div className="mb-8 space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-[#E7E5E4]" />
          <div className="h-9 w-64 animate-pulse rounded bg-[#E7E5E4]" />
          <div className="h-4 w-48 animate-pulse rounded bg-[#E7E5E4]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FCFBF7] text-[#1F1D1B]">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">

        {/* ── Header greeting ── */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C84B31]">
                User Dashboard
              </span>
            </div>
            <h1 className="font-editorial mt-2 text-3xl font-normal tracking-tight text-[#1F1D1B] sm:text-4xl">
              Welcome back,{" "}
              <span className="text-[#C84B31] italic">
                {user?.name}
              </span>
            </h1>
            <p className="mt-1 text-xs text-[#78716C]">
              Kelola koneksi, koin, dan mulai bermain bersama pasanganmu.
            </p>
          </div>

          <Link
            href="/dashboard/games"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#C84B31] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26]"
          >
            <span>🎮</span>
            Mulai Main Game
          </Link>
        </div>

        {error ? (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        ) : null}

        {/* ── Onboarding Checklist (untuk user baru) ── */}
        {(() => {
          const steps = [
            {
              id: "partner",
              done: isLinked,
              label: "Hubungkan partner",
              desc: "Masukkan couple code pasanganmu",
              href: "/dashboard/couple",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              ),
            },
            {
              id: "coin",
              done: (wallet?.balance ?? 0) >= 3,
              label: "Top up koin",
              desc: "Minimal 3 koin untuk mulai game",
              href: "/dashboard/coin",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v2M12 16v2M9 9h4a1 1 0 0 1 0 2H9M9 13h5a1 1 0 0 1 0 2H9" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              id: "game",
              done: hasPlayedGame,
              label: "Main game pertama",
              desc: "Coba Truth or Dare bersama pasangan",
              href: "/dashboard/games",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="3" />
                  <path d="M6 12h4M8 10v4M15 11h2M15 13h2" strokeLinecap="round" />
                </svg>
              ),
            },
          ];
          const doneCount = steps.filter((s) => s.done).length;
          if (doneCount === steps.length) return null;
          return (
            <div className="mb-8 overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-[#F5F5F4] bg-[#FCFBF7] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1F1D1B]">Langkah Memulai 🚀</span>
                  <span className="rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-2 py-0.5 text-[10px] font-bold text-[#C84B31]">
                    {doneCount}/{steps.length} Selesai
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E7E5E4]">
                  <div
                    className="h-full rounded-full bg-[#C84B31] transition-all duration-500"
                    style={{ width: `${(doneCount / steps.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="divide-y divide-[#F5F5F4]">
                {steps.map((step) => (
                  <Link
                    key={step.id}
                    href={step.href}
                    className={`flex items-center gap-3 px-5 py-3 transition hover:bg-[#FCFBF7] ${step.done ? "opacity-60" : ""}`}
                  >
                    {/* Checkbox */}
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      step.done
                        ? "border-[#10B981] bg-[#EBF9EB] text-[#10B981]"
                        : "border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C]"
                    }`}>
                      {step.done ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        step.icon
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold ${step.done ? "text-[#78716C] line-through" : "text-[#1F1D1B]"}`}>
                        {step.label}
                      </p>
                      {!step.done && (
                        <p className="text-[11px] text-[#78716C]">{step.desc}</p>
                      )}
                    </div>
                    {!step.done && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#78716C" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Stats Row ── */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {/* Coin Balance */}
          <div className="relative overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xs transition-all hover:border-[#D6D3D1]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">
                  Saldo Koin
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-editorial text-4xl font-normal text-[#1F1D1B]">
                    {wallet?.balance ?? 0}
                  </span>
                  <span className="text-xs font-medium text-[#78716C]">koin</span>
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#FDE68A] bg-[#FEF3C7]">
                <span className="text-lg">🪙</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[#F5F5F4] pt-3">
              <Link
                href="/dashboard/coin"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#C84B31] transition hover:text-[#B33E26]"
              >
                Top up koin sekarang →
              </Link>
            </div>
          </div>

          {/* Status Couple */}
          <div className="relative overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xs transition-all hover:border-[#D6D3D1]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">
                  Status Pasangan
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${
                      isLinked ? "bg-[#10B981]" : "bg-[#78716C]"
                    }`}
                  />
                  <p className="font-editorial text-2xl font-normal capitalize text-[#1F1D1B]">
                    {isLinked ? "Terhubung" : "Belum Terhubung"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-[#78716C]">
                  {isLinked ? `Bersama ${partner?.name}` : "Hubungkan akun kalian"}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isLinked ? "border-[#BBF7D0] bg-[#EBF9EB] text-[#10B981]" : "border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C]"
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 border-t border-[#F5F5F4] pt-3">
              <Link
                href="/dashboard/couple"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F1D1B] transition hover:text-[#C84B31]"
              >
                {isLinked ? "Kelola pasangan →" : "Hubungkan sekarang →"}
              </Link>
            </div>
          </div>

          {/* Profile Card */}
          <Link
            href="/dashboard/profile"
            className="group relative overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xs transition-all hover:border-[#D6D3D1]"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FDF4F2] border border-[#E7E5E4] font-bold text-[#C84B31]">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">Akun Saya</p>
                <p className="truncate text-base font-bold text-[#1F1D1B]">{user?.name}</p>
                <p className="truncate text-xs text-[#78716C]">{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F5F5F4] pt-3 text-xs font-semibold text-[#78716C] transition group-hover:text-[#C84B31]">
              <span>Pengaturan Profil</span>
              <span>→</span>
            </div>
          </Link>
        </div>

        {/* ── Couple Code + Partner ── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {/* Couple Code */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E7E5E4] bg-[#FDF4F2] p-6 shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C84B31]">
                  Couple Code Kamu
                </p>
                <span className="rounded-full border border-[#E7E5E4] bg-white px-2 py-0.5 text-[10px] font-bold text-[#78716C]">
                  ID Pasangan
                </span>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold tracking-[0.15em] text-[#C84B31]">
                {coupleCode || "—"}
              </p>
              <p className="mt-2 text-xs text-[#78716C]">
                Bagikan kode ini ke pasanganmu untuk menghubungkan akun kalian.
              </p>
            </div>
            <div className="mt-5">
              {coupleCode ? <CopyButton text={coupleCode} /> : null}
            </div>
          </div>

          {/* Partner */}
          {partner ? (
            <div className="flex flex-col justify-between rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">
                  Partner Terhubung
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FDF4F2] border border-[#E7E5E4] text-xl font-bold text-[#C84B31]">
                    {partner.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-[#1F1D1B]">{partner.name}</p>
                    <p className="truncate text-xs text-[#78716C]">{partner.email}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#BBF7D0] bg-[#EBF9EB] px-2.5 py-0.5 text-[10px] font-semibold text-[#1D7D1D]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                      Terhubung
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 border-t border-[#F5F5F4] pt-3">
                <Link
                  href="/dashboard/couple"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F1D1B] transition hover:text-[#C84B31]"
                >
                  Kelola koneksi pasangan →
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-between rounded-2xl border border-dashed border-[#E7E5E4] bg-white p-6 shadow-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">
                  Partner
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1F1D1B]">Belum ada partner terhubung</p>
                    <p className="text-[11px] text-[#78716C]">Masukkan couple code pasanganmu</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 border-t border-[#F5F5F4] pt-3">
                <Link
                  href="/dashboard/couple"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#C84B31] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#B33E26]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Hubungkan Sekarang
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Active Session Banner ── */}
        {activeSession && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-[#E7E5E4] bg-[#FDF4F2] p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-[#E7E5E4] text-2xl shadow-2xs">
                  🎮
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1F1D1B]">
                    {activeSession.host_user_id === user?.id
                      ? "Kamu sedang menunggu partner di game"
                      : "Partner mengajakmu bermain!"}
                  </p>
                  <p className="text-xs text-[#78716C]">
                    {GAME_LABELS[activeSession.game_type] ?? activeSession.game_type} · Kode Sesi: <span className="font-mono font-bold text-[#C84B31]">{activeSession.session_code}</span>
                  </p>
                </div>
              </div>
              <Link
                href={activeSession.host_user_id === user?.id
                  ? (GAME_ROUTES[activeSession.game_type] ?? "/dashboard/games")
                  : `${GAME_ROUTES[activeSession.game_type] ?? "/dashboard/games"}?join=${activeSession.session_code}`}
                className="shrink-0 rounded-lg bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26]"
              >
                {activeSession.host_user_id === user?.id ? "Kembali ke Game" : "Join Sekarang →"}
              </Link>
            </div>
          </div>
        )}

        {/* ── Anniversary Widget ── */}
        {upcomingAnniversaries.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">
                Momen Terdekat
              </p>
              <Link href="/dashboard/anniversaries" className="text-xs font-semibold text-[#C84B31] transition hover:underline">
                Lihat semua →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {upcomingAnniversaries.map((ann) => {
                const days = daysUntil(ann.date);
                const isToday = days === 0;
                return (
                  <div
                    key={ann.id}
                    className={`relative overflow-hidden rounded-2xl border p-5 shadow-xs transition-all ${
                      isToday
                        ? "border-[#E7E5E4] bg-[#FDF4F2]"
                        : "border-[#E7E5E4] bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#1F1D1B]">{ann.title}</p>
                        <p className="font-editorial mt-1 text-3xl font-normal text-[#C84B31]">
                          {isToday ? "Hari Ini!" : days}
                        </p>
                        <p className="text-[10px] text-[#78716C]">
                          {isToday ? "Selamat merayakan!" : "hari lagi"}
                        </p>
                      </div>
                      <span className="text-xl shrink-0">{isToday ? "🎉" : "📅"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Quick Access Cards ── */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">
              Fitur & Menu Utama
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-col justify-between rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xs transition-all duration-200 hover:border-[#D6D3D1] hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FCFBF7] border border-[#F5F5F4]">
                      {item.icon}
                    </div>
                    {item.tag ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.tagColor}`}>
                        {item.tag}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-bold text-[#1F1D1B] group-hover:text-[#C84B31] transition">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-[#78716C]">{item.sublabel}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-1 border-t border-[#F5F5F4] pt-3 text-xs font-semibold text-[#78716C] transition group-hover:text-[#C84B31]">
                  <span>Buka menu</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
