"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const GAME_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  tod:          { label: "Truth or Dare", icon: "🔥", color: "#FF3D7F", bg: "#FF3D7F" },
  snake_ladder: { label: "Ular Tangga",   icon: "🎲", color: "#34D399", bg: "#34D399" },
  dare_derby:   { label: "Dare Derby",    icon: "🏁", color: "#F97316", bg: "#F97316" },
};

type Stats = {
  myId: string;
  myName: string;
  partnerId: string | null;
  partnerName: string;
  totalGames: number;
  streak: number;
  favoriteGame: string | null;
  favoriteGameCount: number;
  gameTypeCounts: Record<string, number>;
  myTotalWins: number;
  partnerTotalWins: number;
  leaderboard: {
    snake_ladder: { myWins: number; partnerWins: number };
    dare_derby: { myWins: number; partnerWins: number };
  };
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />;
}

function WinBar({
  myName,
  partnerName,
  myWins,
  partnerWins,
  color,
}: {
  myName: string;
  partnerName: string;
  myWins: number;
  partnerWins: number;
  color: string;
}) {
  const total = myWins + partnerWins;
  const myPct = total === 0 ? 50 : Math.round((myWins / total) * 100);
  const partnerPct = 100 - myPct;
  const isDraw = myWins === partnerWins;
  const myWinner = myWins > partnerWins;

  return (
    <div className="space-y-2">
      {/* Names + scores */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${myWinner ? "text-[#FFF5F8]" : "text-[#5C5470]"}`}>
          {myWinner && !isDraw && <span className="mr-1">👑</span>}{myName}
        </span>
        <span className="tabular-nums font-bold" style={{ color }}>
          {myWins} : {partnerWins}
        </span>
        <span className={`font-semibold ${!myWinner && !isDraw ? "text-[#FFF5F8]" : "text-[#5C5470]"}`}>
          {!myWinner && !isDraw && <span className="mr-1">👑</span>}{partnerName}
        </span>
      </div>
      {/* Progress bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="transition-all duration-700"
          style={{ width: `${myPct}%`, background: color }}
        />
        <div
          className="transition-all duration-700"
          style={{ width: `${partnerPct}%`, background: `${color}40` }}
        />
      </div>
      {/* Percentage */}
      <div className="flex justify-between text-[10px] text-[#5C5470]">
        <span>{myPct}%</span>
        <span>{isDraw ? "🤝 Seri" : ""}</span>
        <span>{partnerPct}%</span>
      </div>
    </div>
  );
}

export default function CoupleStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/game/couple-stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data);
        else setError(json.message);
      })
      .catch(() => setError("Gagal memuat statistik"))
      .finally(() => setLoading(false));
  }, []);

  const favMeta = stats?.favoriteGame ? GAME_META[stats.favoriteGame] : null;
  const overallWinner =
    !stats ? null
    : stats.myTotalWins > stats.partnerTotalWins ? stats.myName
    : stats.partnerTotalWins > stats.myTotalWins ? stats.partnerName
    : null;

  return (
    <main className="relative mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-64 w-96 -translate-x-1/2 rounded-full blur-[100px]"
        style={{ background: "radial-gradient(ellipse, rgba(129,140,248,0.12) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Games</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#FFF5F8]">
            Statistik &{" "}
            <span style={{ backgroundImage: "linear-gradient(90deg, #818CF8, #F472B6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Leaderboard
            </span>
          </h1>
        </div>
        <Link
          href="/dashboard/games/history"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[#9B93B0] transition hover:border-white/20 hover:text-[#FFF5F8]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Riwayat
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
          </div>
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/8 p-5 text-sm text-red-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : !stats ? null : (
        <div className="space-y-5">

          {/* ── Summary Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total games */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-4 text-center">
              <p className="text-3xl font-bold tabular-nums text-[#FFF5F8]">{stats.totalGames}</p>
              <p className="mt-1 text-[10px] text-[#5C5470]">Game Dimainkan</p>
            </div>

            {/* Streak */}
            <div className="rounded-2xl border border-[#F472B6]/20 bg-[#F472B6]/5 p-4 text-center">
              <p className="text-3xl font-bold tabular-nums text-[#F472B6]">
                {stats.streak > 0 ? `🔥${stats.streak}` : "0"}
              </p>
              <p className="mt-1 text-[10px] text-[#5C5470]">Hari Beruntun</p>
            </div>

            {/* Favorite game */}
            <div className="rounded-2xl border border-[#818CF8]/20 bg-[#818CF8]/5 p-4 text-center">
              <p className="text-3xl">{favMeta?.icon ?? "—"}</p>
              <p className="mt-1 text-[10px] text-[#5C5470]">{favMeta?.label ?? "Belum ada"}</p>
              {stats.favoriteGameCount > 0 && (
                <p className="text-[10px] text-[#818CF8]">{stats.favoriteGameCount}× main</p>
              )}
            </div>

            {/* Overall winner */}
            <div className="rounded-2xl border border-[#34D399]/20 bg-[#34D399]/5 p-4 text-center">
              <p className="text-2xl font-bold text-[#34D399] truncate">
                {overallWinner ? `👑` : `🤝`}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#34D399] truncate">
                {overallWinner ?? "Seri"}
              </p>
              <p className="text-[10px] text-[#5C5470]">Unggul Overall</p>
            </div>
          </div>

          {/* ── Leaderboard ─────────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
            <div className="border-b border-white/[0.05] px-5 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5470]">
                🏆 Leaderboard Couple
              </p>
            </div>
            <div className="divide-y divide-white/[0.04] p-5 space-y-6">

              {/* Ular Tangga */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🎲</span>
                  <p className="text-sm font-semibold text-[#FFF5F8]">Ular Tangga</p>
                  <span className="ml-auto text-[10px] text-[#5C5470]">
                    {stats.leaderboard.snake_ladder.myWins + stats.leaderboard.snake_ladder.partnerWins} game
                  </span>
                </div>
                <WinBar
                  myName={stats.myName}
                  partnerName={stats.partnerName}
                  myWins={stats.leaderboard.snake_ladder.myWins}
                  partnerWins={stats.leaderboard.snake_ladder.partnerWins}
                  color="#34D399"
                />
              </div>

              {/* Dare Derby */}
              <div className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🏁</span>
                  <p className="text-sm font-semibold text-[#FFF5F8]">Dare Derby</p>
                  <span className="ml-auto text-[10px] text-[#5C5470]">
                    {stats.leaderboard.dare_derby.myWins + stats.leaderboard.dare_derby.partnerWins} game
                  </span>
                </div>
                <WinBar
                  myName={stats.myName}
                  partnerName={stats.partnerName}
                  myWins={stats.leaderboard.dare_derby.myWins}
                  partnerWins={stats.leaderboard.dare_derby.partnerWins}
                  color="#F97316"
                />
              </div>

              {/* Overall */}
              <div className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">⚔️</span>
                  <p className="text-sm font-semibold text-[#FFF5F8]">Overall</p>
                  <span className="ml-auto rounded-full bg-[#818CF8]/15 px-2 py-0.5 text-[10px] font-bold text-[#818CF8]">
                    All Games
                  </span>
                </div>
                <WinBar
                  myName={stats.myName}
                  partnerName={stats.partnerName}
                  myWins={stats.myTotalWins}
                  partnerWins={stats.partnerTotalWins}
                  color="#818CF8"
                />
              </div>
            </div>
          </div>

          {/* ── Game Breakdown ──────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
            <div className="border-b border-white/[0.05] px-5 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5470]">
                📊 Breakdown per Game
              </p>
            </div>
            <div className="p-5 space-y-3">
              {Object.entries(GAME_META).map(([key, meta]) => {
                const count = stats.gameTypeCounts[key] ?? 0;
                const pct = stats.totalGames > 0 ? Math.round((count / stats.totalGames) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-lg w-7 shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-[#9B93B0]">{meta.label}</p>
                        <p className="text-xs tabular-nums font-bold text-[#FFF5F8]">{count}×</p>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: meta.color }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-[#5C5470] w-8 text-right">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <Link
              href="/dashboard/games"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.25)] transition hover:bg-[#FF6B9D]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="6" width="20" height="12" rx="3" /><path d="M6 12h4M8 10v4M15 11h2M15 13h2" strokeLinecap="round" />
              </svg>
              Main Sekarang
            </Link>
            <Link
              href="/dashboard/games/history"
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#9B93B0] transition hover:border-white/20 hover:text-[#FFF5F8]"
            >
              Riwayat
            </Link>
          </div>

        </div>
      )}
    </main>
  );
}
