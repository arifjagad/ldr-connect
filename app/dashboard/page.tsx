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
      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#9B93B0] transition hover:border-[#FF3D7F]/40 hover:bg-[#FF3D7F]/10 hover:text-[#FF6B9D]"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${className}`}>
      <div className="p-5 space-y-3">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-6 w-32 rounded bg-white/10" />
      </div>
    </div>
  );
}

const navItems = [
  {
    href: "/dashboard/games",
    label: "Games",
    sublabel: "Mainkan bersama",
    gradient: "from-[#FF3D7F]/20 to-[#FF6B9D]/5",
    border: "border-[#FF3D7F]/20 hover:border-[#FF3D7F]/50",
    iconBg: "bg-[#FF3D7F]/20",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF3D7F" strokeWidth="1.8">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M6 12h4M8 10v4M15 11h2M15 13h2" strokeLinecap="round" />
      </svg>
    ),
    tag: "Hot",
    tagColor: "bg-[#FF3D7F]/20 text-[#FF6B9D]",
  },
  {
    href: "/dashboard/coin",
    label: "Coin Topup",
    sublabel: "Isi saldo kamu",
    gradient: "from-[#34D399]/15 to-[#6EE7B7]/5",
    border: "border-[#34D399]/20 hover:border-[#34D399]/50",
    iconBg: "bg-[#34D399]/20",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v2M12 16v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 5M12 17h.01" strokeLinecap="round" />
      </svg>
    ),
    tag: null,
    tagColor: "",
  },
  {
    href: "/dashboard/couple",
    label: "Couple Connection",
    sublabel: "Kelola partner",
    gradient: "from-[#818CF8]/15 to-[#A78BFA]/5",
    border: "border-[#818CF8]/20 hover:border-[#818CF8]/50",
    iconBg: "bg-[#818CF8]/20",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.8">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    tag: null,
    tagColor: "",
  },
  {
    href: "/dashboard/anniversaries",
    label: "Anniversary Tracker",
    sublabel: "Momen berharga",
    gradient: "from-[#F472B6]/15 to-[#E879F9]/5",
    border: "border-[#F472B6]/20 hover:border-[#F472B6]/50",
    iconBg: "bg-[#F472B6]/20",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    tag: null,
    tagColor: "",
  },
];

type ActiveSession = { session_code: string; game_type: string; host_user_id: string; status: string; expires_at: string } | null;

const GAME_LABELS: Record<string, string> = {
  tod:          "Truth or Dare",
  snake_ladder: "Ular Tangga",
  dare_derby:   "Dare Derby",
};

const GAME_ROUTES: Record<string, string> = {
  tod:          "/dashboard/games/tod",
  snake_ladder: "/dashboard/games/snake-ladder",
  dare_derby:   "/dashboard/games/dare-derby",
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
          // Profil belum terbuat (trigger belum jalan) — arahkan user re-login
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
        };

        setUser(profileData);
        setCoupleCode(profile.couple_code ?? "");
        setWallet({
          user_id: profile.id,
          balance: walletBalance,
          updated_at: wallets?.updated_at ?? profile.created_at,
        });

        // Load anniversaries aktif milik pasangan (RLS handles couple visibility)
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

        // Cek active session di semua game (untuk banner "sedang dalam game")
        try {
          const sessionRes = await fetch("/api/game/session/any-active");
          const sessionJson = await sessionRes.json();
          setActiveSession(sessionJson?.data?.session ?? null);
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

  // Realtime: update banner saat status sesi berubah (cancelled / completed)
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

  // Timer: hapus banner saat join window habis — hanya untuk status 'waiting'
  // (untuk 'playing', expires_at sudah lewat sejak partner join, jadi tidak boleh dicek)
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
      <main className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-8">
        <div className="mb-10 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-10 w-64 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
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
    <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-[420px] w-[700px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(255,61,127,0.12) 0%, transparent 70%)" }}
      />

      {/* ── Header greeting ── */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
          User Dashboard
        </p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Welcome back,{" "}
          <span
            style={{
              backgroundImage: "linear-gradient(90deg, #FF6B9D, #FF3D7F)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {user?.name}
          </span>{" "}
          👋
        </h1>
        <p className="mt-2 text-sm text-[#5C5470]">
          Semua yang kamu butuhkan ada di sini.
        </p>
      </div>

      {error ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : null}

      {/* ── Stats Row ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {/* Coin Balance */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">
                Coin Balance
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-[#FFF5F8]">
                {wallet?.balance ?? 0}
              </p>
              <p className="mt-1 text-xs text-[#5C5470]">coins tersedia</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#34D399]/15">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v2M12 16v2M9 9h4a1 1 0 0 1 0 2H9M9 13h5a1 1 0 0 1 0 2H9" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl"
            style={{ background: "rgba(52,211,153,0.1)" }}
          />
          <Link
            href="/dashboard/coin"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#34D399] hover:text-[#6EE7B7] transition"
          >
            Top up sekarang
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Status Couple */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">
                Status
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    isLinked ? "bg-[#34D399] shadow-[0_0_8px_#34D399]" : "bg-[#5C5470]"
                  }`}
                />
                <p className="text-2xl font-bold capitalize text-[#FFF5F8]">
                  {user?.status}
                </p>
              </div>
              <p className="mt-1 text-xs text-[#5C5470]">
                {isLinked ? `Terhubung dengan ${partner?.name}` : "Belum ada partner"}
              </p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLinked ? "bg-[#FF3D7F]/15" : "bg-white/5"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLinked ? "#FF3D7F" : "#5C5470"} strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl"
            style={{ background: isLinked ? "rgba(255,61,127,0.08)" : "transparent" }}
          />
          <Link
            href="/dashboard/couple"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#9B93B0] hover:text-[#FFF5F8] transition"
          >
            {isLinked ? "Lihat partner" : "Hubungkan sekarang"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Profile */}
        <Link href="/dashboard/profile" className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5 transition hover:border-white/15">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#FF3D7F]/30 to-[#818CF8]/30 text-xl font-bold text-[#FFF5F8]">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-[#FFF5F8]">{user?.name}</p>
              <p className="truncate text-xs text-[#5C5470]">{user?.email}</p>
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#9B93B0] transition group-hover:text-[#FFF5F8]">
                Edit profil
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Couple Code + Partner ── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {/* Couple Code */}
        <div className="flex flex-col rounded-2xl border border-[#FF3D7F]/15 bg-linear-to-br from-[#FF3D7F]/8 to-transparent p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">
            Couple Code Kamu
          </p>
          <p className="mt-3 font-mono text-3xl font-bold tracking-[0.15em] text-[#FF6B9D]">
            {coupleCode || "—"}
          </p>
          <p className="mt-2 text-xs text-[#5C5470]">
            Bagikan ke pasanganmu agar bisa terhubung.
          </p>
          <div className="mt-4">
            {coupleCode ? <CopyButton text={coupleCode} /> : null}
          </div>
        </div>

        {/* Partner */}
        {partner ? (
          <div className="relative overflow-hidden flex flex-col rounded-2xl border border-[#818CF8]/20 bg-linear-to-br from-[#818CF8]/10 to-transparent p-5">
            {/* glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
              style={{ background: "rgba(129,140,248,0.15)" }}
            />
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Partner</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#818CF8]/30 to-[#F472B6]/30 text-2xl font-bold text-[#FFF5F8]">
                {partner.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#FFF5F8]">{partner.name}</p>
                <p className="truncate text-xs text-[#5C5470]">{partner.email}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#34D399]/25 bg-[#34D399]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#34D399]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
                  Terhubung
                </span>
              </div>
            </div>
            <div className="mt-4 border-t border-white/6 pt-4">
              <Link
                href="/dashboard/couple"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9B93B0] transition hover:text-[#FFF5F8]"
              >
                Kelola koneksi
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Partner</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 text-[#5C5470]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#9B93B0]">Belum ada partner</p>
                <p className="text-xs text-[#5C5470]">Hubungkan menggunakan couple code</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/dashboard/couple"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 px-3 py-2 text-xs font-medium text-[#818CF8] transition hover:border-[#818CF8]/50 hover:bg-[#818CF8]/20"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Hubungkan Partner
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Active Session Banner ── */}
      {activeSession && (
        <div className={`mb-6 overflow-hidden rounded-2xl border p-4 ${
          activeSession.host_user_id === user?.id
            ? "border-[#818CF8]/30 bg-[#818CF8]/8"
            : "border-[#FF3D7F]/30 bg-[#FF3D7F]/8"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {activeSession.host_user_id === user?.id ? "🎮" : "👾"}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">
                  {activeSession.host_user_id === user?.id
                    ? "Kamu sedang menunggu partner di game"
                    : "Partner mengajakmu bermain!"}
                </p>
                <p className="text-xs text-[#9B93B0]">
                  {GAME_LABELS[activeSession.game_type] ?? activeSession.game_type} · Kode: <span className="font-mono font-bold">{activeSession.session_code}</span>
                </p>
              </div>
            </div>
            <Link
              href={activeSession.host_user_id === user?.id
                ? (GAME_ROUTES[activeSession.game_type] ?? "/dashboard/games")
                : `${GAME_ROUTES[activeSession.game_type] ?? "/dashboard/games"}?join=${activeSession.session_code}`}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                activeSession.host_user_id === user?.id
                  ? "bg-[#818CF8] hover:bg-[#A78BFA]"
                  : "bg-[#FF3D7F] hover:bg-[#FF6B9D]"
              }`}
            >
              {activeSession.host_user_id === user?.id ? "Kembali" : "Join Sekarang"}
            </Link>
          </div>
        </div>
      )}

      {/* ── Anniversary Widget ── */}
      {upcomingAnniversaries.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">
              Momen Terdekat
            </p>
            <Link href="/dashboard/anniversaries" className="text-xs text-[#9B93B0] hover:text-[#FFF5F8] transition">
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
                  className={`relative overflow-hidden rounded-2xl border p-4 ${
                    isToday
                      ? "border-[#F472B6]/40 bg-[#F472B6]/10"
                      : days <= 7
                      ? "border-yellow-500/25 bg-yellow-500/5"
                      : "border-white/[0.07] bg-[#111113]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#9B93B0]">{ann.title}</p>
                      <p className={`mt-1 text-2xl font-bold tabular-nums ${
                        isToday ? "text-[#F472B6]" : days <= 7 ? "text-yellow-400" : "text-[#FFF5F8]"
                      }`}>
                        {isToday ? "🎉" : days}
                      </p>
                      <p className="text-[10px] text-[#5C5470]">
                        {isToday ? "Hari ini!" : `hari lagi`}
                      </p>
                    </div>
                    <span className="text-xl shrink-0">{isToday ? "🎊" : days <= 7 ? "⏳" : "📅"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Access Cards ── */}
      <div>
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#5C5470]">
          Menu Utama
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative overflow-hidden rounded-2xl border bg-linear-to-br ${item.gradient} ${item.border} p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.iconBg}`}>
                  {item.icon}
                </div>
                {item.tag ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.tagColor}`}>
                    {item.tag}
                  </span>
                ) : null}
              </div>
              <div className="mt-4">
                <p className="font-semibold text-[#FFF5F8]">{item.label}</p>
                <p className="mt-0.5 text-xs text-[#9B93B0]">{item.sublabel}</p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#5C5470] transition group-hover:text-[#9B93B0]">
                Buka
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
