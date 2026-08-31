"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { ShareResult } from "@/components/ui/ShareResult";
import type { TodQuestion } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameSession = {
  id: number;
  session_code: string;
  game_type: "tod" | "snake_ladder" | "dare_derby" | "quiz" | "quoridor";
  status: "completed" | "expired" | "cancelled";
  questions: TodQuestion[];
  game_state: Record<string, any> | null;
  coin_deducted: number;
  partner_joined_at: string | null;
  expires_at: string | null;
  created_at: string;
  host_user_id: string;
  partner_user_id: string | null;
};

type Profile = { name: string; avatar_url: string | null };
type Profiles = Record<string, Profile>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GAME_META: Record<string, { label: string; icon: string; color: string }> = {
  tod:          { label: "Truth or Dare", icon: "🔥", color: "#FF3D7F" },
  snake_ladder: { label: "Ular Tangga",   icon: "🎲", color: "#34D399" },
  dare_derby:   { label: "Dare Derby",    icon: "🏁", color: "#F97316" },
  quiz:         { label: "Quiz Pasangan", icon: "🧠", color: "#818CF8" },
  quoridor:     { label: "Quoridor",      icon: "♟️", color: "#10B981" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return `Hari ini, ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: GameSession["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#34D399]/15 px-2 py-0.5 text-[10px] font-semibold text-[#34D399]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
        Selesai
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FBBF24]/15 px-2 py-0.5 text-[10px] font-semibold text-[#FBBF24]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
        Waktu Habis
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#5C5470]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#5C5470]" />
      Dibatalkan
    </span>
  );
}

/** Hitung result (win/lose/draw/complete) dan summary text berdasarkan game_type */
function getResultInfo(
  session: GameSession,
  currentUserId: string
): {
  result: "win" | "lose" | "draw" | "complete" | null;
  resultLabel: React.ReactNode;
  summary: string;
} {
  const myRole = session.host_user_id === currentUserId ? "host" : "partner";

  // ── Snake Ladder ──────────────────────────────────────────────────────────
  if (session.game_type === "snake_ladder") {
    const winner: string | null = session.game_state?.winner ?? null;
    if (!winner) return { result: null, resultLabel: <span className="text-xs text-[#5C5470]">—</span>, summary: "" };
    const iWon = winner === myRole;
    return {
      result: iWon ? "win" : "lose",
      resultLabel: (
        <span className={`text-xs font-semibold ${iWon ? "text-[#34D399]" : "text-red-400"}`}>
          {iWon ? "Menang" : "Kalah"}
        </span>
      ),
      summary: "Ular Tangga",
    };
  }

  // ── Dare Derby ────────────────────────────────────────────────────────────
  if (session.game_type === "dare_derby") {
    const gs = session.game_state;
    if (!gs) return { result: null, resultLabel: <span className="text-xs text-[#5C5470]">—</span>, summary: "" };

    const hostDares: number = gs.dare_counts?.host ?? 0;
    const partnerDares: number = gs.dare_counts?.partner ?? 0;
    const myDares = myRole === "host" ? hostDares : partnerDares;
    const oppDares = myRole === "host" ? partnerDares : hostDares;
    const totalRounds = (session.questions ?? []).length;

    let result: "win" | "lose" | "draw" = "draw";
    if (gs.forfeit_by) {
      result = gs.forfeit_by === myRole ? "lose" : "win";
    } else if (myDares < oppDares) {
      result = "win";
    } else if (oppDares < myDares) {
      result = "lose";
    }

    return {
      result,
      resultLabel: (
        <span className={`text-xs font-semibold ${
          result === "win" ? "text-[#34D399]" :
          result === "lose" ? "text-red-400" : "text-[#9B93B0]"
        }`}>
          {result === "win" ? "Menang" : result === "lose" ? "Kalah" : "Seri"}
        </span>
      ),
      summary: `${myDares} dare vs ${oppDares} dare · ${totalRounds} ronde`,
    };
  }

  // ── Truth or Dare ─────────────────────────────────────────────────────────
  if (session.game_type === "tod") {
    const total = session.questions?.length ?? 0;
    const done = session.questions?.filter((q) => q.is_completed).length ?? 0;
    if (total === 0) return { result: null, resultLabel: <span className="text-xs text-[#5C5470]">—</span>, summary: "" };
    return {
      result: "complete",
      resultLabel: (
        <span className="text-xs font-semibold text-[#34D399]">
          {done}/{total} pertanyaan
        </span>
      ),
      summary: `${done}/${total} pertanyaan dijawab`,
    };
  }

  // ── Quoridor ──────────────────────────────────────────────────────────────
  if (session.game_type === "quoridor") {
    const winner: string | null = session.game_state?.winner ?? null;
    if (!winner) {
      // Waktu habis tanpa pemenang
      return {
        result: "complete",
        resultLabel: <span className="text-xs text-[#FBBF24]">Waktu Habis</span>,
        summary: "Quoridor · waktu habis",
      };
    }
    const iWon = winner === myRole;
    return {
      result: iWon ? "win" : "lose",
      resultLabel: (
        <span className={`text-xs font-semibold ${iWon ? "text-[#34D399]" : "text-red-400"}`}>
          {iWon ? "Menang" : "Kalah"}
        </span>
      ),
      summary: `Quoridor · ${iWon ? "Kamu menang" : "Kamu kalah"}`,
    };
  }

  return { result: null, resultLabel: <span className="text-xs text-[#5C5470]">—</span>, summary: "" };
}

// ─── Stats computation ────────────────────────────────────────────────────────

function computeStats(sessions: GameSession[], userId: string) {
  const completedSessions = sessions.filter((s) => s.status === "completed");

  // Win / Lose / Draw for competitive games
  let wins = 0, losses = 0, draws = 0;
  for (const s of completedSessions) {
    const { result } = getResultInfo(s, userId);
    if (result === "win")       wins++;
    else if (result === "lose") losses++;
    else if (result === "draw") draws++;
  }
  const competitive = wins + losses + draws;
  const winRate = competitive > 0 ? Math.round((wins / competitive) * 100) : null;

  // Game type breakdown
  const gameCount: Record<string, number> = {};
  for (const s of sessions) {
    gameCount[s.game_type] = (gameCount[s.game_type] ?? 0) + 1;
  }
  const sortedGames = Object.entries(gameCount).sort((a, b) => b[1] - a[1]);
  const favoriteGame = sortedGames[0]?.[0] ?? null;
  const maxCount     = sortedGames[0]?.[1] ?? 1;

  // Total coins spent
  const totalCoins = sessions.reduce((sum, s) => sum + (s.coin_deducted ?? 0), 0);

  // Last 14-day activity
  const now = Date.now();
  const activityMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    activityMap[d.toISOString().split("T")[0]] = 0;
  }
  for (const s of sessions) {
    const key = s.created_at.split("T")[0];
    if (key in activityMap) activityMap[key]++;
  }
  const activityData = Object.entries(activityMap).map(([date, count]) => ({ date, count }));
  const maxActivity  = Math.max(...activityData.map((d) => d.count), 1);

  return {
    total: sessions.length,
    completedCount: completedSessions.length,
    wins, losses, draws, competitive, winRate,
    sortedGames, favoriteGame, maxCount,
    totalCoins, activityData, maxActivity,
  };
}

// ─── Stats Section Component ──────────────────────────────────────────────────

function StatsSection({ sessions, userId }: { sessions: GameSession[]; userId: string }) {
  const stats    = useMemo(() => computeStats(sessions, userId), [sessions, userId]);
  const todayKey = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Chart height constant: h-16 = 64px
  const CHART_H = 64;

  return (
    <div className="mb-8 space-y-4">

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        {/* Total sesi */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div aria-hidden className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl" style={{ background: "rgba(129,140,248,0.2)" }} />
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">Total Sesi</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-[#FFF5F8]">{stats.total}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            <p className="text-[11px] text-[#5C5470]">{stats.completedCount} selesai</p>
          </div>
        </div>

        {/* Win Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div aria-hidden className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl" style={{ background: "rgba(52,211,153,0.2)" }} />
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">Win Rate</p>
          {stats.winRate !== null ? (
            <>
              <p className="mt-3 text-4xl font-bold tabular-nums text-[#34D399]">{stats.winRate}%</p>
              <p className="mt-2 text-[11px] text-[#5C5470]">{stats.wins}W · {stats.losses}L{stats.draws > 0 ? ` · ${stats.draws}D` : ""}</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-4xl font-bold text-[#5C5470]">—</p>
              <p className="mt-2 text-[11px] text-[#5C5470]">belum ada data</p>
            </>
          )}
        </div>

        {/* Favorit */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl"
            style={{ background: `${GAME_META[stats.favoriteGame ?? ""]?.color ?? "#FF3D7F"}35` }}
          />
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">Favorit</p>
          {stats.favoriteGame ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ background: `${GAME_META[stats.favoriteGame]?.color ?? "#9B93B0"}20` }}
                >
                  {GAME_META[stats.favoriteGame]?.icon}
                </span>
                <p className="text-sm font-bold leading-tight text-[#FFF5F8]">
                  {GAME_META[stats.favoriteGame]?.label ?? stats.favoriteGame}
                </p>
              </div>
              <p className="mt-2 text-[11px] text-[#5C5470]">{stats.sortedGames[0][1]}× dimainkan</p>
            </>
          ) : (
            <p className="mt-3 text-4xl font-bold text-[#5C5470]">—</p>
          )}
        </div>

        {/* Coins dipakai */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div aria-hidden className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl" style={{ background: "rgba(249,115,22,0.18)" }} />
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">Coin Dipakai</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-[#FB923C]">{stats.totalCoins}</p>
          <p className="mt-2 text-[11px] text-[#5C5470]">dari {stats.total} sesi</p>
        </div>
      </div>

      {/* ── Row 2: Game breakdown + Activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Game distribution */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5470]">Breakdown Per Game</p>
          <div className="mt-5 space-y-4">
            {stats.sortedGames.map(([type, count]) => {
              const meta = GAME_META[type] ?? { label: type, icon: "🎮", color: "#9B93B0" };
              const pct  = Math.round((count / stats.total) * 100);
              const barW = Math.round((count / stats.maxCount) * 100);
              return (
                <div key={type}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-[#C4B5FD]">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded text-xs"
                        style={{ background: `${meta.color}20` }}
                      >
                        {meta.icon}
                      </span>
                      {meta.label}
                    </span>
                    <span className="text-xs tabular-nums text-[#FFF5F8]">
                      <span className="font-semibold">{count}×</span>
                      <span className="ml-1 text-[#5C5470]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barW}%`, background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity + W/L/D */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5470]">Aktivitas 14 Hari</p>

          {/*
            Bar chart fix:
            - Outer div: h-16 (= 64px), no items-end (default stretch so children fill height)
            - Each column: h-full flex flex-col justify-end → bar pins to bottom
            - Bar height in px (not %) to avoid circular % calculation
            - Floor line: absolute bottom border
          */}
          <div className="relative mt-5">
            <div className="absolute bottom-0 inset-x-0 h-px bg-white/[0.07]" />
            <div className="flex gap-[3px]" style={{ height: 64 }}>
              {stats.activityData.map(({ date, count }) => {
                const isToday  = date === todayKey;
                const heightPx = count > 0
                  ? Math.max(8, Math.round((count / stats.maxActivity) * 64))
                  : 2;
                return (
                  <div
                    key={date}
                    title={`${count} sesi`}
                    className="group relative flex flex-1 flex-col justify-end"
                    style={{ height: "100%" }}
                  >
                    {/* CSS tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#1A1A22] px-2 py-1 text-[9px] text-[#C4B5FD] ring-1 ring-white/10 group-hover:block z-20">
                      {count > 0 ? `${count} sesi` : "—"}
                    </div>

                    <div
                      className="w-full transition-all duration-500"
                      style={{
                        height: heightPx,
                        borderRadius: "2px 2px 0 0",
                        background: count > 0
                          ? isToday
                            ? "linear-gradient(to top, #FF3D7F, #FF6B9D)"
                            : "linear-gradient(to top, #6366F1, #818CF8)"
                          : "rgba(255,255,255,0.05)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis: tanggal per bar */}
          <div className="mt-1 flex gap-[3px]">
            {stats.activityData.map(({ date, count }, i) => {
              const isToday = date === todayKey;
              const d       = new Date(date + "T12:00:00");
              const day     = d.getDate();
              const month   = d.getMonth();
              // Tampilkan DD/MM di awal bulan atau bar pertama, sisanya DD saja
              const label   = (day === 1 || i === 0)
                ? `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`
                : String(day);
              return (
                <div
                  key={date}
                  className="flex flex-1 items-center justify-center"
                >
                  <span
                    className="text-center leading-none"
                    style={{
                      fontSize: 8,
                      color: isToday ? "#FF3D7F" : count > 0 ? "#6B7280" : "#374151",
                      fontWeight: isToday ? 700 : 400,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* W/L/D segmented bar */}
          {stats.competitive > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-medium text-[#5C5470]">Menang / Seri / Kalah</p>
                <p className="text-[10px] text-[#5C5470]">{stats.competitive} game</p>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
                {stats.wins > 0 && (
                  <div className="h-full transition-all duration-700" style={{ width: `${(stats.wins / stats.competitive) * 100}%`, background: "#34D399" }} />
                )}
                {stats.draws > 0 && (
                  <div className="h-full transition-all duration-700" style={{ width: `${(stats.draws / stats.competitive) * 100}%`, background: "#9B93B0" }} />
                )}
                {stats.losses > 0 && (
                  <div className="h-full transition-all duration-700" style={{ width: `${(stats.losses / stats.competitive) * 100}%`, background: "#EF4444" }} />
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-[#34D399]">
                  <span className="h-2 w-2 rounded-sm bg-[#34D399]" />{stats.wins} Menang
                </span>
                {stats.draws > 0 && (
                  <span className="flex items-center gap-1.5 text-[11px] text-[#9B93B0]">
                    <span className="h-2 w-2 rounded-sm bg-[#9B93B0]" />{stats.draws} Seri
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[11px] text-red-400">
                  <span className="h-2 w-2 rounded-sm bg-red-400" />{stats.losses} Kalah
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  currentUserId,
  profiles,
}: {
  session: GameSession;
  currentUserId: string;
  profiles: Profiles;
}) {
  const [showShare, setShowShare] = useState(false);
  const meta = GAME_META[session.game_type] ?? { label: session.game_type, icon: "🎮", color: "#9B93B0" };
  const { result, resultLabel, summary } = getResultInfo(session, currentUserId);

  const myName = profiles[currentUserId]?.name ?? "Kamu";
  const partnerUserId = session.host_user_id === currentUserId
    ? session.partner_user_id
    : session.host_user_id;
  const partnerName = partnerUserId ? (profiles[partnerUserId]?.name ?? "Partner") : "Partner";
  const myAvatarUrl = profiles[currentUserId]?.avatar_url ?? null;
  const partnerAvatarUrl = partnerUserId ? (profiles[partnerUserId]?.avatar_url ?? null) : null;

  // Progress: untuk ToD pakai questions, dare_derby pakai rounds selesai
  const totalQ = session.game_type === "tod" ? (session.questions?.length ?? 0) : 0;
  const completedQ = session.game_type === "tod" ? (session.questions?.filter((q) => q.is_completed).length ?? 0) : 0;
  const progressPct = totalQ > 0 ? Math.round((completedQ / totalQ) * 100) : 0;

  // Dare derby: progress = ronde selesai / total ronde (dari questions)
  const dareRounds = session.game_type === "dare_derby" ? (session.questions ?? []).length : 0;
  const dareConfig = session.game_state?.total_rounds ?? dareRounds;

  const canShare = result !== null && session.status === "completed";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition hover:border-white/15">
      {/* Top color strip */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${meta.color}80, transparent)` }}
      />

      <div className="flex items-start gap-4 p-5">
        {/* Game icon */}
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ background: `${meta.color}20` }}
        >
          {meta.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#FFF5F8]">{meta.label}</span>
              <StatusBadge status={session.status} />
            </div>
            <span className="text-xs text-[#5C5470]">{formatDate(session.created_at)}</span>
          </div>

          {/* Progress bar — ToD */}
          {session.game_type === "tod" && totalQ > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-[#5C5470] mb-1">
                <span>Pertanyaan dijawab</span>
                <span>{completedQ}/{totalQ}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    background: session.status === "completed"
                      ? "linear-gradient(90deg, #34D399, #6EE7B7)"
                      : "linear-gradient(90deg, #FBBF24, #F59E0B)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Progress bar — Dare Derby */}
          {session.game_type === "dare_derby" && dareRounds > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-[#5C5470] mb-1">
                <span>Ronde dimainkan</span>
                <span>{dareRounds}{dareConfig ? `/${dareConfig}` : ""}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: dareConfig > 0 ? `${Math.round((dareRounds / dareConfig) * 100)}%` : "100%",
                    background: session.status === "completed"
                      ? "linear-gradient(90deg, #F97316, #FBBF24)"
                      : "linear-gradient(90deg, #FBBF24, #F59E0B)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#5C5470]">
              <span className="font-mono tracking-wider">{session.session_code}</span>
              <span>•</span>
              <span>{session.coin_deducted} coin</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                Hasil: {resultLabel}
              </span>
            </div>

            {/* Share toggle button */}
            {canShare && (
              <button
                type="button"
                onClick={() => setShowShare((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold ring-1 transition ${
                  showShare
                    ? "bg-[#FF3D7F]/15 text-[#FF6B9D] ring-[#FF3D7F]/30"
                    : "bg-white/5 text-[#5C5470] ring-white/[0.07] hover:bg-white/10 hover:text-[#9B93B0]"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {showShare ? "Tutup" : "Bagikan"}
              </button>
            )}
          </div>

          {/* ShareResult panel */}
          {showShare && canShare && result && (
            <div className="mt-3">
              <ShareResult
                gameName={meta.label}
                gameEmoji={meta.icon}
                result={result}
                summary={summary || undefined}
                myName={myName}
                partnerName={partnerName}
                myAvatarUrl={myAvatarUrl}
                partnerAvatarUrl={partnerAvatarUrl}
                playedAt={session.created_at}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

export default function GameHistoryPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [profiles, setProfiles] = useState<Profiles>({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/game/sessions/history");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Gagal memuat riwayat");
        setSessions(json.data.sessions ?? []);
        setProfiles(json.data.profiles ?? {});
        setCurrentUserId(json.data.currentUserId ?? user?.id ?? "");
        setPage(1); // reset ke halaman pertama setiap load
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="relative mx-auto w-full max-w-6xl px-6 py-12 lg:px-8">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(129,140,248,0.08) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
          <Link href="/dashboard/games" className="transition hover:text-[#9B93B0]">Games</Link>
          {" / "}History
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#818CF8]/15 text-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.8">
              <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#FFF5F8]">Riwayat Game</h1>
            <p className="text-sm text-[#5C5470]">Semua sesi game yang pernah dimainkan</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <svg className="animate-spin text-[#818CF8]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-[#5C5470]">Memuat riwayat…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#111113] py-20 text-center">
          <div className="text-4xl">🎮</div>
          <div>
            <p className="font-semibold text-[#9B93B0]">Belum ada riwayat game</p>
            <p className="mt-1 text-sm text-[#5C5470]">Main game bareng pasanganmu dan riwayatnya akan muncul di sini.</p>
          </div>
          <Link
            href="/dashboard/games"
            className="mt-2 rounded-xl bg-[#FF3D7F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#FF6B9D]"
          >
            Main Sekarang
          </Link>
        </div>
      )}

      {/* Session list + pagination */}
      {!loading && !error && sessions.length > 0 && (() => {
        const totalPages     = Math.ceil(sessions.length / ITEMS_PER_PAGE);
        const start          = (page - 1) * ITEMS_PER_PAGE;
        const paginated      = sessions.slice(start, start + ITEMS_PER_PAGE);
        const pageNumbers: number[] = [];

        // Tampilkan maks 5 nomor halaman di sekitar halaman saat ini
        const delta = 2;
        for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
          pageNumbers.push(i);
        }

        return (
          <>
            {/* ── Stats Section ── */}
            <StatsSection sessions={sessions} userId={currentUserId || user?.id || ""} />

            {/* ── Session list header ── */}
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Riwayat Sesi</p>
              <p className="text-xs text-[#5C5470]">{sessions.length} total</p>
            </div>

            <div className="space-y-3">
              {paginated.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  currentUserId={currentUserId || user?.id || ""}
                  profiles={profiles}
                />
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-2">
                {/* Info */}
                <p className="text-xs text-[#5C5470] shrink-0">
                  {start + 1}–{Math.min(start + ITEMS_PER_PAGE, sessions.length)} dari {sessions.length} sesi
                </p>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  {/* Prev */}
                  <button
                    type="button"
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Halaman sebelumnya"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* First page + ellipsis */}
                  {pageNumbers[0] > 1 && (
                    <>
                      <button type="button" onClick={() => { setPage(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-[#9B93B0] transition hover:bg-white/10">
                        1
                      </button>
                      {pageNumbers[0] > 2 && <span className="px-1 text-xs text-[#5C5470]">…</span>}
                    </>
                  )}

                  {/* Page numbers */}
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition ${
                        n === page
                          ? "border-[#818CF8]/40 bg-[#818CF8]/15 text-[#818CF8]"
                          : "border-white/10 bg-white/5 text-[#9B93B0] hover:bg-white/10"
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  {/* Last page + ellipsis */}
                  {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="px-1 text-xs text-[#5C5470]">…</span>}
                      <button type="button" onClick={() => { setPage(totalPages); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-[#9B93B0] transition hover:bg-white/10">
                        {totalPages}
                      </button>
                    </>
                  )}

                  {/* Next */}
                  <button
                    type="button"
                    onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Halaman berikutnya"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Back button */}
      {!loading && (
        <div className="mt-8">
          <Link
            href="/dashboard/games"
            className="flex items-center gap-2 text-sm text-[#5C5470] transition hover:text-[#9B93B0]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Kembali ke Games
          </Link>
        </div>
      )}
    </main>
  );
}
