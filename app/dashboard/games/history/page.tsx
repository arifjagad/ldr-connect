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
  tod:          { label: "Truth or Dare", icon: "🔥", color: "#C84B31" },
  snake_ladder: { label: "Ular Tangga",   icon: "🎲", color: "#10B981" },
  dare_derby:   { label: "Dare Derby",    icon: "🏁", color: "#D97706" },
  quiz:         { label: "Quiz Pasangan", icon: "🧠", color: "#4F46E5" },
  quoridor:     { label: "Quoridor",      icon: "♟️", color: "#6366F1" },
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
      <span className="inline-flex items-center gap-1 rounded-full border border-[#10B981]/20 bg-[#EBF9EB] px-2.5 py-0.5 text-[10px] font-bold text-[#10B981]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
        Selesai
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[10px] font-bold text-[#D97706]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
        Waktu Habis
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-[#FCFBF7] px-2.5 py-0.5 text-[10px] font-bold text-[#78716C]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#78716C]" />
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
    if (!winner) return { result: null, resultLabel: <span className="text-xs text-[#78716C]">—</span>, summary: "" };
    const iWon = winner === myRole;
    return {
      result: iWon ? "win" : "lose",
      resultLabel: (
        <span className={`text-xs font-bold ${iWon ? "text-[#10B981]" : "text-red-600"}`}>
          {iWon ? "Menang 🏆" : "Kalah"}
        </span>
      ),
      summary: "Ular Tangga",
    };
  }

  // ── Dare Derby ────────────────────────────────────────────────────────────
  if (session.game_type === "dare_derby") {
    const gs = session.game_state;
    if (!gs) return { result: null, resultLabel: <span className="text-xs text-[#78716C]">—</span>, summary: "" };

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
        <span className={`text-xs font-bold ${
          result === "win" ? "text-[#10B981]" :
          result === "lose" ? "text-red-600" : "text-[#78716C]"
        }`}>
          {result === "win" ? "Menang 🏆" : result === "lose" ? "Kalah" : "Seri 🤝"}
        </span>
      ),
      summary: `${myDares} dare vs ${oppDares} dare · ${totalRounds} ronde`,
    };
  }

  // ── Truth or Dare ─────────────────────────────────────────────────────────
  if (session.game_type === "tod") {
    const total = session.questions?.length ?? 0;
    const done = session.questions?.filter((q) => q.is_completed).length ?? 0;
    if (total === 0) return { result: null, resultLabel: <span className="text-xs text-[#78716C]">—</span>, summary: "" };
    return {
      result: "complete",
      resultLabel: (
        <span className="text-xs font-bold text-[#10B981]">
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
      return {
        result: "complete",
        resultLabel: <span className="text-xs font-bold text-[#D97706]">Waktu Habis</span>,
        summary: "Quoridor · waktu habis",
      };
    }
    const iWon = winner === myRole;
    return {
      result: iWon ? "win" : "lose",
      resultLabel: (
        <span className={`text-xs font-bold ${iWon ? "text-[#10B981]" : "text-red-600"}`}>
          {iWon ? "Menang 🏆" : "Kalah"}
        </span>
      ),
      summary: `Quoridor · ${iWon ? "Kamu menang" : "Kamu kalah"}`,
    };
  }

  return { result: null, resultLabel: <span className="text-xs text-[#78716C]">—</span>, summary: "" };
}

// ─── Stats computation ────────────────────────────────────────────────────────

function computeStats(sessions: GameSession[], userId: string) {
  const completedSessions = sessions.filter((s) => s.status === "completed");

  let wins = 0, losses = 0, draws = 0;
  for (const s of completedSessions) {
    const { result } = getResultInfo(s, userId);
    if (result === "win")       wins++;
    else if (result === "lose") losses++;
    else if (result === "draw") draws++;
  }
  const competitive = wins + losses + draws;
  const winRate = competitive > 0 ? Math.round((wins / competitive) * 100) : null;

  const gameCount: Record<string, number> = {};
  for (const s of sessions) {
    gameCount[s.game_type] = (gameCount[s.game_type] ?? 0) + 1;
  }
  const sortedGames = Object.entries(gameCount).sort((a, b) => b[1] - a[1]);
  const favoriteGame = sortedGames[0]?.[0] ?? null;
  const maxCount     = sortedGames[0]?.[1] ?? 1;

  const totalCoins = sessions.reduce((sum, s) => sum + (s.coin_deducted ?? 0), 0);

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

  return (
    <div className="mb-8 space-y-4">

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        {/* Total sesi */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#78716C]">Total Sesi</p>
          <p className="mt-2 font-serif text-3xl font-bold tabular-nums text-[#1F1D1B]">{stats.total}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <p className="text-[11px] font-semibold text-[#78716C]">{stats.completedCount} selesai</p>
          </div>
        </div>

        {/* Win Rate */}
        <div className="rounded-2xl border border-[#10B981]/20 bg-[#EBF9EB] p-4 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#059669]">Win Rate</p>
          {stats.winRate !== null ? (
            <>
              <p className="mt-2 font-serif text-3xl font-bold tabular-nums text-[#10B981]">{stats.winRate}%</p>
              <p className="mt-2 text-[11px] font-semibold text-[#059669]">{stats.wins}W · {stats.losses}L{stats.draws > 0 ? ` · ${stats.draws}D` : ""}</p>
            </>
          ) : (
            <>
              <p className="mt-2 font-serif text-3xl font-bold text-[#78716C]">—</p>
              <p className="mt-2 text-[11px] font-semibold text-[#78716C]">Belum ada data</p>
            </>
          )}
        </div>

        {/* Favorit */}
        <div className="rounded-2xl border border-[#E0E7FF] bg-[#EEF2FF] p-4 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6366F1]">Favorit</p>
          {stats.favoriteGame ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl">
                  {GAME_META[stats.favoriteGame]?.icon}
                </span>
                <p className="text-xs font-bold leading-tight text-[#4F46E5] truncate">
                  {GAME_META[stats.favoriteGame]?.label ?? stats.favoriteGame}
                </p>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#6366F1]">{stats.sortedGames[0][1]}× dimainkan</p>
            </>
          ) : (
            <p className="mt-2 font-serif text-3xl font-bold text-[#78716C]">—</p>
          )}
        </div>

        {/* Coins dipakai */}
        <div className="rounded-2xl border border-[#FBDCD5] bg-[#FDF4F2] p-4 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C84B31]">Coin Dipakai</p>
          <p className="mt-2 font-serif text-3xl font-bold tabular-nums text-[#C84B31]">{stats.totalCoins}</p>
          <p className="mt-2 text-[11px] font-semibold text-[#C84B31]">Dari {stats.total} sesi</p>
        </div>
      </div>

      {/* ── Row 2: Game breakdown + Activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Game distribution */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-xl shadow-black/2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">Breakdown Per Game</p>
          <div className="mt-4 space-y-3.5">
            {stats.sortedGames.map(([type, count]) => {
              const meta = GAME_META[type] ?? { label: type, icon: "🎮", color: "#78716C" };
              const pct  = Math.round((count / stats.total) * 100);
              const barW = Math.round((count / stats.maxCount) * 100);
              return (
                <div key={type}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-[#1F1D1B]">
                      <span>{meta.icon}</span>
                      {meta.label}
                    </span>
                    <span className="text-xs tabular-nums text-[#1F1D1B]">
                      <span className="font-bold">{count}×</span>
                      <span className="ml-1 text-[#78716C]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#FCFBF7] border border-[#E7E5E4]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barW}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity + W/L/D */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-xl shadow-black/2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">Aktivitas 14 Hari</p>

          <div className="relative mt-5">
            <div className="absolute bottom-0 inset-x-0 h-px bg-[#E7E5E4]" />
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
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#1F1D1B] px-2 py-1 text-[9px] font-semibold text-white shadow-md group-hover:block z-20">
                      {count > 0 ? `${count} sesi` : "—"}
                    </div>

                    <div
                      className="w-full transition-all duration-500 rounded-t-xs"
                      style={{
                        height: heightPx,
                        background: count > 0
                          ? isToday
                            ? "#C84B31"
                            : "#4F46E5"
                          : "#E7E5E4",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis: tanggal per bar */}
          <div className="mt-2 flex gap-[3px]">
            {stats.activityData.map(({ date, count }, i) => {
              const isToday = date === todayKey;
              const d       = new Date(date + "T12:00:00");
              const day     = d.getDate();
              const month   = d.getMonth();
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
                      color: isToday ? "#C84B31" : count > 0 ? "#78716C" : "#A8A29E",
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
            <div className="mt-4 border-t border-[#E7E5E4] pt-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#78716C]">
                <span>Menang / Seri / Kalah</span>
                <span>{stats.competitive} game</span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#FCFBF7] border border-[#E7E5E4]">
                {stats.wins > 0 && (
                  <div className="h-full transition-all duration-700 bg-[#10B981]" style={{ width: `${(stats.wins / stats.competitive) * 100}%` }} />
                )}
                {stats.draws > 0 && (
                  <div className="h-full transition-all duration-700 bg-[#A8A29E]" style={{ width: `${(stats.draws / stats.competitive) * 100}%` }} />
                )}
                {stats.losses > 0 && (
                  <div className="h-full transition-all duration-700 bg-red-500" style={{ width: `${(stats.losses / stats.competitive) * 100}%` }} />
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-4">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#10B981]">
                  <span className="h-2 w-2 rounded-xs bg-[#10B981]" />{stats.wins} Menang
                </span>
                {stats.draws > 0 && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#78716C]">
                    <span className="h-2 w-2 rounded-xs bg-[#A8A29E]" />{stats.draws} Seri
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-600">
                  <span className="h-2 w-2 rounded-xs bg-red-500" />{stats.losses} Kalah
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
  const meta = GAME_META[session.game_type] ?? { label: session.game_type, icon: "🎮", color: "#78716C" };
  const { result, resultLabel, summary } = getResultInfo(session, currentUserId);

  const myName = profiles[currentUserId]?.name ?? "Kamu";
  const partnerUserId = session.host_user_id === currentUserId
    ? session.partner_user_id
    : session.host_user_id;
  const partnerName = partnerUserId ? (profiles[partnerUserId]?.name ?? "Partner") : "Partner";
  const myAvatarUrl = profiles[currentUserId]?.avatar_url ?? null;
  const partnerAvatarUrl = partnerUserId ? (profiles[partnerUserId]?.avatar_url ?? null) : null;

  const totalQ = session.game_type === "tod" ? (session.questions?.length ?? 0) : 0;
  const completedQ = session.game_type === "tod" ? (session.questions?.filter((q) => q.is_completed).length ?? 0) : 0;
  const progressPct = totalQ > 0 ? Math.round((completedQ / totalQ) * 100) : 0;

  const dareRounds = session.game_type === "dare_derby" ? (session.questions ?? []).length : 0;
  const dareConfig = session.game_state?.total_rounds ?? dareRounds;

  const canShare = result !== null && session.status === "completed";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2 transition hover:border-[#D6D3D1]">
      <div
        className="h-1 w-full"
        style={{ background: meta.color }}
      />

      <div className="flex items-start gap-4 p-5">
        {/* Game icon */}
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg border border-[#E7E5E4] bg-[#FCFBF7]"
        >
          {meta.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1F1D1B]">{meta.label}</span>
              <StatusBadge status={session.status} />
            </div>
            <span className="text-xs text-[#78716C]">{formatDate(session.created_at)}</span>
          </div>

          {/* Progress bar — ToD */}
          {session.game_type === "tod" && totalQ > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-semibold text-[#78716C] mb-1">
                <span>Pertanyaan dijawab</span>
                <span>{completedQ}/{totalQ}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FCFBF7] border border-[#E7E5E4]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    background: session.status === "completed" ? "#10B981" : "#D97706",
                  }}
                />
              </div>
            </div>
          )}

          {/* Progress bar — Dare Derby */}
          {session.game_type === "dare_derby" && dareRounds > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-semibold text-[#78716C] mb-1">
                <span>Ronde dimainkan</span>
                <span>{dareRounds}{dareConfig ? `/${dareConfig}` : ""}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FCFBF7] border border-[#E7E5E4]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: dareConfig > 0 ? `${Math.round((dareRounds / dareConfig) * 100)}%` : "100%",
                    background: session.status === "completed" ? "#C84B31" : "#D97706",
                  }}
                />
              </div>
            </div>
          )}

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#78716C]">
              <span className="font-mono font-semibold text-[#1F1D1B]">{session.session_code}</span>
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
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                  showShare
                    ? "bg-[#FDF4F2] text-[#C84B31] border-[#FBDCD5]"
                    : "bg-white text-[#78716C] border-[#E7E5E4] hover:border-[#D6D3D1] hover:text-[#1F1D1B]"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {showShare ? "Tutup" : "Bagikan"}
              </button>
            )}
          </div>

          {/* ShareResult panel */}
          {showShare && canShare && result && (
            <div className="mt-4 border-t border-[#E7E5E4] pt-4">
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
        setPage(1);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/games"
            className="text-xs font-semibold uppercase tracking-wider text-[#78716C] hover:text-[#C84B31] transition"
          >
            Games
          </Link>
          <span className="text-xs text-[#A8A29E]">/</span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#C84B31]">Riwayat</span>
        </div>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1D1B] sm:text-3xl">
          Riwayat Game
        </h1>
        <p className="mt-1 text-xs text-[#78716C]">
          Daftar seluruh sesi game yang pernah kamu mainkan bersama pasangan.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <svg className="animate-spin text-[#C84B31]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          <p className="text-xs font-semibold text-[#78716C]">Memuat riwayat…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-xs font-semibold text-red-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#E7E5E4] bg-white p-12 text-center shadow-xl shadow-black/2">
          <div className="text-4xl">🎮</div>
          <div>
            <p className="font-serif text-lg font-bold text-[#1F1D1B]">Belum ada riwayat game</p>
            <p className="mt-1 text-xs text-[#78716C]">Main game bareng pasanganmu dan riwayatnya akan muncul di sini.</p>
          </div>
          <Link
            href="/dashboard/games"
            className="mt-2 rounded-xl bg-[#C84B31] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26]"
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

        const delta = 2;
        for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
          pageNumbers.push(i);
        }

        return (
          <>
            {/* ── Stats Section ── */}
            <StatsSection sessions={sessions} userId={currentUserId || user?.id || ""} />

            {/* ── Session list header ── */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">Riwayat Sesi</p>
              <p className="text-xs font-semibold text-[#78716C]">{sessions.length} total sesi</p>
            </div>

            <div className="space-y-3.5">
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
              <div className="mt-8 flex items-center justify-between gap-2">
                <p className="text-xs text-[#78716C] shrink-0">
                  {start + 1}–{Math.min(start + ITEMS_PER_PAGE, sessions.length)} dari {sessions.length} sesi
                </p>

                <div className="flex items-center gap-1.5">
                  {/* Prev */}
                  <button
                    type="button"
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7E5E4] bg-white text-[#78716C] transition hover:border-[#D6D3D1] hover:text-[#1F1D1B] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                        className="flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#E7E5E4] bg-white px-2.5 text-xs font-semibold text-[#78716C] transition hover:border-[#D6D3D1] hover:text-[#1F1D1B] cursor-pointer">
                        1
                      </button>
                      {pageNumbers[0] > 2 && <span className="px-1 text-xs text-[#A8A29E]">…</span>}
                    </>
                  )}

                  {/* Page numbers */}
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-xl border px-2.5 text-xs font-bold transition cursor-pointer ${
                        n === page
                          ? "border-[#FBDCD5] bg-[#FDF4F2] text-[#C84B31]"
                          : "border-[#E7E5E4] bg-white text-[#78716C] hover:border-[#D6D3D1] hover:text-[#1F1D1B]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  {/* Last page + ellipsis */}
                  {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="px-1 text-xs text-[#A8A29E]">…</span>}
                      <button type="button" onClick={() => { setPage(totalPages); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className="flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#E7E5E4] bg-white px-2.5 text-xs font-semibold text-[#78716C] transition hover:border-[#D6D3D1] hover:text-[#1F1D1B] cursor-pointer">
                        {totalPages}
                      </button>
                    </>
                  )}

                  {/* Next */}
                  <button
                    type="button"
                    onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7E5E4] bg-white text-[#78716C] transition hover:border-[#D6D3D1] hover:text-[#1F1D1B] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
    </main>
  );
}
