"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import type { TodQuestion } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameSession = {
  id: number;
  session_code: string;
  game_type: "tod" | "snake_ladder" | "quiz";
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

function ResultBadge({ session, currentUserId }: { session: GameSession; currentUserId: string }) {
  if (session.game_type === "snake_ladder" && session.game_state) {
    const winner: string | null = session.game_state.winner ?? null;
    if (!winner) return <span className="text-xs text-[#5C5470]">—</span>;

    const myRole = session.host_user_id === currentUserId ? "host" : "partner";
    const iWon = winner === myRole;

    return (
      <span className={`text-xs font-semibold ${iWon ? "text-[#34D399]" : "text-red-400"}`}>
        {iWon ? "Menang" : "Kalah"}
      </span>
    );
  }
  return <span className="text-xs text-[#5C5470]">—</span>;
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
    <main className="relative mx-auto w-full max-w-3xl px-6 py-12 lg:px-8">
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
          {sessions.map((s) => {
            const meta = GAME_META[s.game_type] ?? { label: s.game_type, icon: "🎮", color: "#9B93B0" };
            const totalQ = s.questions?.length ?? 0;
            const completedQ = s.questions?.filter((q) => q.is_completed).length ?? 0;
            const progressPct = totalQ > 0 ? Math.round((completedQ / totalQ) * 100) : 0;

            return (
              <div
                key={s.id}
                className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition hover:border-white/15"
              >
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
                        <StatusBadge status={s.status} />
                      </div>
                      <span className="text-xs text-[#5C5470]">{formatDate(s.created_at)}</span>
                    </div>

                    {/* Progress bar (for question-based games) */}
                    {totalQ > 0 && (
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
                              background: s.status === "completed"
                                ? "linear-gradient(90deg, #34D399, #6EE7B7)"
                                : "linear-gradient(90deg, #FBBF24, #F59E0B)",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#5C5470]">
                      <span className="font-mono tracking-wider">{s.session_code}</span>
                      <span>•</span>
                      <span>{s.coin_deducted} coin</span>
                      <span>•</span>
                      {/* Hasil: menang/kalah untuk game future, — untuk ToD */}
                      <span className="flex items-center gap-1">
                        Hasil: <ResultBadge session={s} currentUserId={user?.id ?? ""} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
