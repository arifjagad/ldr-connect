"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const GAME_META: Record<string, { label: string; icon: string; color: string }> = {
  tod:          { label: "Truth or Dare", icon: "🔥", color: "#C84B31" },
  snake_ladder: { label: "Ular Tangga",   icon: "🎲", color: "#10B981" },
  dare_derby:   { label: "Dare Derby",    icon: "🏁", color: "#D97706" },
  quoridor:     { label: "Quoridor",      icon: "♟️", color: "#4F46E5" },
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
  return <div className={`animate-pulse rounded-2xl bg-[#E7E5E4]/50 ${className}`} />;
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
        <span className={`font-bold ${myWinner ? "text-[#1F1D1B]" : "text-[#78716C]"}`}>
          {myWinner && !isDraw && <span className="mr-1">👑</span>}{myName}
        </span>
        <span className="tabular-nums font-mono font-bold" style={{ color }}>
          {myWins} : {partnerWins}
        </span>
        <span className={`font-bold ${!myWinner && !isDraw ? "text-[#1F1D1B]" : "text-[#78716C]"}`}>
          {!myWinner && !isDraw && <span className="mr-1">👑</span>}{partnerName}
        </span>
      </div>
      {/* Progress bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-[#FCFBF7] border border-[#E7E5E4]">
        <div
          className="transition-all duration-700"
          style={{ width: `${myPct}%`, background: color }}
        />
        <div
          className="transition-all duration-700 opacity-30"
          style={{ width: `${partnerPct}%`, background: color }}
        />
      </div>
      {/* Percentage */}
      <div className="flex justify-between text-[10px] font-semibold text-[#78716C]">
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
    <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/games"
              className="text-xs font-semibold uppercase tracking-wider text-[#78716C] hover:text-[#C84B31] transition"
            >
              Games
            </Link>
            <span className="text-xs text-[#A8A29E]">/</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#C84B31]">Statistik</span>
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1D1B] sm:text-3xl">
            Statistik & Leaderboard
          </h1>
          <p className="mt-1 text-xs text-[#78716C]">
            Pantau rekor kemenangan dan performa game pasanganmu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/games/history"
            className="flex items-center gap-1.5 rounded-xl border border-[#E7E5E4] bg-white px-3.5 py-2 text-xs font-semibold text-[#78716C] shadow-2xs transition hover:border-[#D6D3D1] hover:text-[#1F1D1B]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Riwayat Game
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
          </div>
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-44" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-xs font-semibold text-red-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : !stats ? null : (
        <div className="space-y-6">

          {/* ── Summary Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total games */}
            <div className="rounded-2xl border border-[#E7E5E4] bg-white p-4 text-center shadow-xl shadow-black/2">
              <p className="font-serif text-3xl font-bold tabular-nums text-[#1F1D1B]">{stats.totalGames}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#78716C]">Game Dimainkan</p>
            </div>

            {/* Streak */}
            <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-4 text-center shadow-xl shadow-black/2">
              <p className="font-serif text-3xl font-bold tabular-nums text-[#D97706]">
                {stats.streak > 0 ? `🔥 ${stats.streak}` : "0"}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#92400E]">Hari Beruntun</p>
            </div>

            {/* Favorite game */}
            <div className="rounded-2xl border border-[#E0E7FF] bg-[#EEF2FF] p-4 text-center shadow-xl shadow-black/2">
              <p className="text-2xl">{favMeta?.icon ?? "🎮"}</p>
              <p className="mt-0.5 text-xs font-bold text-[#4F46E5] truncate">{favMeta?.label ?? "Belum ada"}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6366F1]">
                {stats.favoriteGameCount > 0 ? `${stats.favoriteGameCount}× main` : "Favorit"}
              </p>
            </div>

            {/* Overall winner */}
            <div className="rounded-2xl border border-[#10B981]/20 bg-[#EBF9EB] p-4 text-center shadow-xl shadow-black/2">
              <p className="text-2xl font-bold text-[#10B981]">
                {overallWinner ? `👑` : `🤝`}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[#10B981] truncate">
                {overallWinner ?? "Seri"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#059669]">Unggul Overall</p>
            </div>
          </div>

          {/* ── Leaderboard ─────────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
            <div className="border-b border-[#E7E5E4] bg-[#FCFBF7] px-5 py-3.5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">
                🏆 Leaderboard Couple
              </p>
            </div>
            <div className="divide-y divide-[#E7E5E4] p-5 sm:p-6 space-y-6">

              {/* Ular Tangga */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🎲</span>
                  <p className="text-xs font-bold text-[#1F1D1B]">Ular Tangga</p>
                  <span className="ml-auto text-[10px] font-semibold text-[#78716C]">
                    {stats.leaderboard.snake_ladder.myWins + stats.leaderboard.snake_ladder.partnerWins} game
                  </span>
                </div>
                <WinBar
                  myName={stats.myName}
                  partnerName={stats.partnerName}
                  myWins={stats.leaderboard.snake_ladder.myWins}
                  partnerWins={stats.leaderboard.snake_ladder.partnerWins}
                  color="#10B981"
                />
              </div>

              {/* Dare Derby */}
              <div className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🏁</span>
                  <p className="text-xs font-bold text-[#1F1D1B]">Dare Derby</p>
                  <span className="ml-auto text-[10px] font-semibold text-[#78716C]">
                    {stats.leaderboard.dare_derby.myWins + stats.leaderboard.dare_derby.partnerWins} game
                  </span>
                </div>
                <WinBar
                  myName={stats.myName}
                  partnerName={stats.partnerName}
                  myWins={stats.leaderboard.dare_derby.myWins}
                  partnerWins={stats.leaderboard.dare_derby.partnerWins}
                  color="#C84B31"
                />
              </div>

              {/* Overall */}
              <div className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">⚔️</span>
                  <p className="text-xs font-bold text-[#1F1D1B]">Overall</p>
                  <span className="ml-auto rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-2.5 py-0.5 text-[10px] font-bold text-[#4F46E5]">
                    All Games
                  </span>
                </div>
                <WinBar
                  myName={stats.myName}
                  partnerName={stats.partnerName}
                  myWins={stats.myTotalWins}
                  partnerWins={stats.partnerTotalWins}
                  color="#4F46E5"
                />
              </div>
            </div>
          </div>

          {/* ── Game Breakdown ──────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
            <div className="border-b border-[#E7E5E4] bg-[#FCFBF7] px-5 py-3.5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">
                📊 Breakdown per Game
              </p>
            </div>
            <div className="p-5 sm:p-6 space-y-3.5">
              {Object.entries(GAME_META).map(([key, meta]) => {
                const count = stats.gameTypeCounts[key] ?? 0;
                const pct = stats.totalGames > 0 ? Math.round((count / stats.totalGames) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-lg w-7 shrink-0 text-center">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-[#1F1D1B]">{meta.label}</p>
                        <p className="text-xs tabular-nums font-bold text-[#1F1D1B]">{count}×</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#FCFBF7] border border-[#E7E5E4]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: meta.color }}
                        />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-[#78716C] w-9 text-right">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <Link
              href="/dashboard/games"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#C84B31] py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="6" width="20" height="12" rx="3" /><path d="M6 12h4M8 10v4M15 11h2M15 13h2" strokeLinecap="round" />
              </svg>
              Main Game Sekarang
            </Link>
            <Link
              href="/dashboard/games/history"
              className="flex items-center justify-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-5 py-3 text-xs font-semibold text-[#78716C] shadow-2xs transition hover:border-[#D6D3D1] hover:text-[#1F1D1B]"
            >
              Riwayat
            </Link>
          </div>

        </div>
      )}
    </main>
  );
}
