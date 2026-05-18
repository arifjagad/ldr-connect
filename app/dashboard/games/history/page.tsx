"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { ShareResult } from "@/components/ui/ShareResult";
import type { TodQuestion } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameSession = {
  id: number;
  session_code: string;
  game_type: "tod" | "snake_ladder" | "dare_derby" | "quiz";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GAME_META: Record<string, { label: string; icon: string; color: string }> = {
  tod:          { label: "Truth or Dare", icon: "🔥", color: "#FF3D7F" },
  snake_ladder: { label: "Ular Tangga",   icon: "🎲", color: "#34D399" },
  dare_derby:   { label: "Dare Derby",    icon: "🏁", color: "#F97316" },
  quiz:         { label: "Quiz Pasangan", icon: "🧠", color: "#818CF8" },
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

  return { result: null, resultLabel: <span className="text-xs text-[#5C5470]">—</span>, summary: "" };
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, currentUserId }: { session: GameSession; currentUserId: string }) {
  const [showShare, setShowShare] = useState(false);
  const meta = GAME_META[session.game_type] ?? { label: session.game_type, icon: "🎮", color: "#9B93B0" };
  const { result, resultLabel, summary } = getResultInfo(session, currentUserId);

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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GameHistoryPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/game/sessions/history");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Gagal memuat riwayat");
        setSessions(json.data.sessions ?? []);
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

      {/* Session list */}
      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              currentUserId={user?.id ?? ""}
            />
          ))}
        </div>
      )}

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
