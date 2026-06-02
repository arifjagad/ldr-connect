"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
import { sendBrowserNotification, requestNotificationPermission } from "@/lib/notifications";
import { TapTimingGame } from "@/components/games/dare-derby/mini-games/TapTimingGame";
import { ReactionButtonGame } from "@/components/games/dare-derby/mini-games/ReactionButtonGame";
import { MemorySequenceGame } from "@/components/games/dare-derby/mini-games/MemorySequenceGame";
import { WordScrambleGame } from "@/components/games/dare-derby/mini-games/WordScrambleGame";
import { TrueFalseGame } from "@/components/games/dare-derby/mini-games/TrueFalseGame";
import { NumberOrderGame } from "@/components/games/dare-derby/mini-games/NumberOrderGame";
import { GamePageLayout, GamePageSkeleton } from "@/components/games/GamePageLayout";
import { GamePlayingHeader } from "@/components/games/GamePlayingHeader";
import { GameFinishedCard } from "@/components/games/GameFinishedCard";
import { GameIdleLayout, GameRulesList } from "@/components/games/GameIdleLayout";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { GameSurrenderModal, GameSurrenderButton } from "@/components/games/GameSurrenderModal";
import type {
  DareDerbySession,
  DareDerbyGameState,
  DareDerbyDareLevel,
} from "@/lib/types";

// ── Minigame metadata ─────────────────────────────────────────────────────────
const MINIGAME_META: Record<string, { name: string; emoji: string; duration: number }> = {
  tap_timing:    { name: "Perfect Tap",   emoji: "⚡", duration: 10 },
  reaction_btn:  { name: "React!",        emoji: "⚡", duration: 8  },
  memory_seq:    { name: "Ingat Urutan",  emoji: "🧠", duration: 30 },
  word_scramble: { name: "Acak Kata",     emoji: "🎯", duration: 20 },
  true_false:    { name: "Benar/Salah",   emoji: "🎯", duration: 30 },
  number_order:  { name: "Urutan Angka",  emoji: "🔢", duration: 25 },
};

const DARE_LEVEL_LABELS: Record<DareDerbyDareLevel, string> = {
  sweet_only: "Sweet Only 🟢",
  mixed:      "Mixed 🟡",
  full_chaos: "Full Chaos 🔴",
};

const COIN_COSTS: Record<number, number> = { 5: 3, 7: 4, 10: 6 };

type PagePhase = "idle" | "setup" | "waiting" | "game" | "finished";
type FinishReason = "completed" | "time_up" | "cancelled" | null;

function fmt(s: number | null) {
  if (s === null) return "--:--";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── Dare category badge ───────────────────────────────────────────────────────
function DareCategoryBadge({ category }: { category: string | null }) {
  const map: Record<string, string> = {
    sweet:     "bg-green-500/20 text-green-400 border-green-500/30",
    funny:     "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    bold:      "bg-orange-500/20 text-orange-400 border-orange-500/30",
    challenge: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  if (!category) return null;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[category] ?? ""}`}>
      {category}
    </span>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function DareDerbyContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<PagePhase>("idle");
  const [session, setSession] = useState<DareDerbySession | null>(null);
  const [gameState, setGameState] = useState<DareDerbyGameState | null>(null);
  const [finishReason, setFinishReason] = useState<FinishReason>(null);

  // Setup
  const [totalRounds, setTotalRounds] = useState<5 | 7 | 10>(5);
  const [dareLevel, setDareLevel] = useState<DareDerbyDareLevel>("mixed");

  // UI
  const [joinCodeInput, setJoinCodeInput] = useState(
    searchParams?.get("join")?.toUpperCase() ?? ""
  );
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [readying, setReadying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [daringAction, setDaringAction] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [showDrawToast, setShowDrawToast] = useState(false);
  const [myRoundResult, setMyRoundResult] = useState<{ score: number; metadata?: Record<string, unknown> } | null>(null);
  const [preJoinCode, setPreJoinCode] = useState<string | null>(null);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Realtime
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const myRole = session
    ? session.host_user_id === user?.id ? "host" : "partner"
    : null;

  const ALL_MINIGAME_IDS = Object.keys(MINIGAME_META);
  const currentMiniGameId = gameState && session
    ? (session.board_config.minigame_sequence[gameState.current_round - 1]
        ?? ALL_MINIGAME_IDS[(gameState.current_round - 1) % ALL_MINIGAME_IDS.length])
    : null;

  const bonusActive = !!(gameState?.pending_bonus_for && gameState.pending_bonus_for === myRole);

  // Timestamp server saat ronde mini-game mulai
  const roundStartedAtRef = useRef<number | null>(null);
  const lastRoundStartRef = useRef<string | null>(null);

  const [roundKey, setRoundKey] = useState(0);

  // Refs untuk state volatile
  const sessionRef     = useRef(session);
  const submittingRef  = useRef(false);
  const submittedRef   = useRef(submitted);
  const bonusActiveRef = useRef(bonusActive);
  const roundKeyRef    = useRef(roundKey);
  useEffect(() => { sessionRef.current     = session;     }, [session]);
  useEffect(() => { submittedRef.current   = submitted;   }, [submitted]);
  useEffect(() => { bonusActiveRef.current = bonusActive; }, [bonusActive]);
  useEffect(() => { roundKeyRef.current    = roundKey;    }, [roundKey]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (!session) return;
    setFinishReason("time_up");
    setPhase("finished");
  }, [session]);

  const timerSeconds = useCountdown(
    phase === "waiting" || phase === "game" ? session?.expires_at ?? null : null,
    handleTimerExpire
  );

  // ── Apply session ──────────────────────────────────────────────────────────
  const prevDDStatusRef = useRef<string | null>(null);
  const applySession = useCallback((s: DareDerbySession | null) => {
    if (!s) { setSession(null); setPhase("idle"); return; }

    const isExpiredByTime =
      s.status !== "completed" && !!s.expires_at && new Date(s.expires_at) < new Date();

    if (s.status === "completed" || s.status === "expired" || s.status === "cancelled" || isExpiredByTime) {
      setSession(s);
      setGameState(s.game_state);
      setFinishReason(
        s.status === "completed" || s.game_state?.phase === "game_over" ? "completed" :
        s.status === "cancelled" ? "cancelled" : "time_up"
      );
      setPhase("finished");
      return;
    }

    setSession(s);
    setGameState(s.game_state);

    if (s.status === "waiting") {
      setPhase("waiting");
    } else if (s.status === "playing") {
      if (prevDDStatusRef.current === "waiting") {
        sendBrowserNotification("Partner sudah bergabung! 🎲", {
          body: "Dare Derby siap dimulai!",
          tag: "partner-join",
        });
      }
      setPhase("game");
      if (
        s.game_state?.phase === "playing" &&
        !s.game_state.round_submissions?.host &&
        !s.game_state.round_submissions?.partner &&
        lastRoundStartRef.current !== s.updated_at
      ) {
        lastRoundStartRef.current = s.updated_at;
        roundStartedAtRef.current = Date.now();
        setSubmitted(false);
        submittedRef.current = false;
        setMyRoundResult(null);
        if (s.game_state.is_replay_round) {
          setShowDrawToast(true);
          setTimeout(() => setShowDrawToast(false), 3000);
        }
        setRoundKey(k => k + 1);
      }
      if (s.game_state?.phase !== "playing") setSubmitted(false);
    }
    prevDDStatusRef.current = s.status;
  }, []);

  // ── Load active session on mount ───────────────────────────────────────────
  useEffect(() => {
    const urlCode = (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("join")
      : null)?.toUpperCase() ?? "";

    if (urlCode) {
      window.history.replaceState({}, "", window.location.pathname);
      setJoinCodeInput(urlCode);
      setPreJoinCode(urlCode);
      setPhase("waiting");
      return;
    }

    fetch("/api/game/dare-derby/session/active")
      .then(r => r.json())
      .then(res => {
        const s = res.data?.session;
        if (!s) return;
        if (s.status === "waiting" && user?.id && s.host_user_id !== user.id) {
          setJoinCodeInput(s.session_code);
          setPreJoinCode(s.session_code);
          setPhase("waiting");
          return;
        }
        applySession(s);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.session_code) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setPartnerOnline(false);
      return;
    }

    const code = session.session_code;
    const channel = supabaseRef.current
      .channel(`dare_derby:${code}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "game_sessions",
        filter: `session_code=eq.${code}`,
      }, (payload) => {
        const updated = payload.new as DareDerbySession;
        if (updated.game_state?.phase !== "playing") {
          setSubmitted(false);
          submittedRef.current = false;
        }
        applySession(updated);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const users = Object.values(state).flat();
        setPartnerOnline(users.some((p) => p.user_id !== user?.id));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeOk(true);
          if (user?.id) await channel.track({ user_id: user.id });
          const res = await fetch(`/api/game/dare-derby/session/${code}`);
          const data = await res.json();
          if (data.data?.session) applySession(data.data.session);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeOk(false);
        }
      });

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setPartnerOnline(false);
      setRealtimeOk(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_code]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function handleReset() {
    if (session?.status === "waiting" && session.host_user_id === user?.id) {
      fetch(`/api/game/session/${session.session_code}/cancel`, { method: "POST" }).catch(() => {});
    }
    setSession(null);
    setGameState(null);
    setPreJoinCode(null);
    setShowSurrenderConfirm(false);
    setPhase("idle");
    setFinishReason(null);
    setMyRoundResult(null);
    setSubmitted(false);
    setShowVideo(false);
  }

  const handleCreate = async () => {
    setLoadingCreate(true);
    try {
      const res = await fetch("/api/game/dare-derby/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_rounds: totalRounds, dare_level: dareLevel }),
      }).then(r => r.json());
      if (!res.success) { toast.error("Gagal membuat sesi", res.message); }
      else { applySession(res.data.session); toast.success("Sesi berhasil dibuat!", "Bagikan kode ke partner dan tunggu mereka bergabung."); requestNotificationPermission(); }
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setLoadingCreate(false); }
  };

  const handleJoin = async () => {
    const code = (preJoinCode ?? joinCodeInput).trim();
    if (!code) return;
    setLoadingJoin(true);
    try {
      const res = await fetch("/api/game/dare-derby/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).then(r => r.json());
      if (!res.success) { toast.error("Gagal bergabung", res.message); }
      else {
        setPreJoinCode(null);
        applySession(res.data.session);
        toast.success("Berhasil bergabung!", "Game akan segera dimulai.");
      }
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setLoadingJoin(false); }
  };

  const handleSurrender = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/game/dare-derby/session/${session.session_code}/surrender`, { method: "POST" }).then(r => r.json());
      if (!res.success) {
        toast.error("Gagal menyerah", res.message ?? "Terjadi kesalahan");
        return;
      }
      if (res.data?.game_state) setGameState(res.data.game_state);
      setFinishReason("completed");
      setPhase("finished");
    } catch (e) {
      toast.error("Gagal menyerah", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setShowSurrenderConfirm(false);
    }
  };

  const handleReadyUp = async () => {
    if (!session || readying) return;
    setReadying(true);
    try {
      const res = await fetch(`/api/game/dare-derby/session/${session.session_code}/ready`, {
        method: "POST",
      }).then(r => r.json());
      if (!res.success) toast.error("Gagal", res.message);
      else if (res.data?.game_state) setGameState(res.data.game_state);
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setReadying(false); }
  };

  const handleGameComplete = useCallback(async (score: number, timeTaken: number, metadata?: Record<string, unknown>) => {
    if (!sessionRef.current || submittingRef.current || submittedRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const finalScore = bonusActiveRef.current ? Math.min(150, score + 50) : score;
    const roundKeyAtSubmit = roundKeyRef.current;
    try {
      const res = await fetch(`/api/game/dare-derby/session/${sessionRef.current.session_code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: finalScore, time_taken: timeTaken, metadata: metadata ?? {} }),
      }).then(r => r.json());
      if (!res.success) {
        if (res.message?.includes("sudah mengirim")) {
          if (!submittedRef.current) {
            setMyRoundResult({ score: finalScore, metadata });
            setSubmitted(true);
          }
        } else {
          toast.error("Gagal submit", res.message);
        }
      }
      else if (res.data?.waiting_for_partner) {
        if (roundKeyRef.current === roundKeyAtSubmit) {
          setMyRoundResult({ score: finalScore, metadata });
          setSubmitted(true);
          setGameState(res.data.game_state);
        }
      }
      else { setGameState(res.data.game_state); }
    } catch { toast.error("Terjadi kesalahan"); }
    finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDareComplete = async () => {
    if (!session || daringAction) return;
    setDaringAction(true);
    try {
      const res = await fetch(`/api/game/dare-derby/session/${session.session_code}/dare/complete`, {
        method: "POST",
      }).then(r => r.json());
      if (!res.success) toast.error("Gagal", res.message);
      else setGameState(res.data.game_state);
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setDaringAction(false); }
  };

  const handleDareConfirm = async (confirmed: boolean) => {
    if (!session || daringAction) return;
    setDaringAction(true);
    try {
      const res = await fetch(`/api/game/dare-derby/session/${session.session_code}/dare/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed }),
      }).then(r => r.json());
      if (!res.success) toast.error("Gagal", res.message);
      else setGameState(res.data.game_state);
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setDaringAction(false); }
  };

  const handleDareSkip = async () => {
    if (!session || daringAction) return;
    setDaringAction(true);
    try {
      const res = await fetch(`/api/game/dare-derby/session/${session.session_code}/dare/skip`, {
        method: "POST",
      }).then(r => r.json());
      if (!res.success) toast.error("Gagal", res.message);
      else setGameState(res.data.game_state);
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setDaringAction(false); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const lastResult = gameState?.last_round_result;
  const amLoser = lastResult?.loser === myRole;
  const amWinner = lastResult?.loser !== myRole && lastResult?.loser !== "draw";
  const dareStatus = lastResult?.dare_status;
  const myReady = gameState?.ready[myRole as "host" | "partner"];
  const partnerReady = gameState?.ready[myRole === "host" ? "partner" : "host"];

  // ── Map internal phase to GamePageLayout phase ─────────────────────────────
  const layoutPhase = phase === "idle" || phase === "setup" ? "idle"
    : phase === "waiting" ? "waiting"
    : phase === "game" ? "playing"
    : "finished";

  // ── Finished derived ──────────────────────────────────────────────────────
  const gs = gameState;
  const hostDares = gs?.dare_counts.host ?? 0;
  const partnerDares = gs?.dare_counts.partner ?? 0;
  const myDares = myRole === "host" ? hostDares : partnerDares;
  const partnerDaresCount = myRole === "host" ? partnerDares : hostDares;
  let winner: "me" | "partner" | "draw" = "draw";
  if (myDares < partnerDaresCount) winner = "me";
  else if (partnerDaresCount < myDares) winner = "partner";
  if (gs?.forfeit_by) {
    winner = gs.forfeit_by === myRole ? "partner" : "me";
  }
  const rounds = session?.questions ?? [];

  const isHostUser = !!(session && user && session.host_user_id === user.id);
  const isPartnerPreJoin = !!(preJoinCode && !session);
  const displayCode = session?.session_code ?? preJoinCode ?? "";

  return (
    <GamePageLayout
      gameName="Dare Derby"
      gameEmoji="🎲"
      gameSlug="dare-derby"
      gameSubtitle="Mini-game kompetitif — yang kalah dapat dare!"
      accentColor="#F97316"
      accentColorLight="#FB923C"
      phase={layoutPhase}
      // Waiting
      sessionCode={displayCode}
      isHost={!isPartnerPreJoin && isHostUser}
      onCancel={handleReset}
      onJoin={(!isHostUser || isPartnerPreJoin) ? handleJoin : undefined}
      joinLoading={loadingJoin}
      expiryMinutes={20}
      waitingTimerSeconds={timerSeconds}
      waitingExtraInfo={session ? `${session.board_config.total_rounds} ronde · ${DARE_LEVEL_LABELS[session.board_config.dare_level]}` : undefined}
      // Playing
      realtimeOk={realtimeOk}
      showVideo={showVideo}
      videoSessionCode={session?.session_code}
      videoGame="dare-derby"
      onVideoLeave={() => setShowVideo(false)}
      // Idle
      idleContent={
        <GameIdleLayout
          accentColor="#F97316"
          accentColorLight="#FB923C"
          joinCodeInput={joinCodeInput}
          onJoinCodeChange={setJoinCodeInput}
          onJoin={handleJoin}
          joinLoading={loadingJoin}
          createContent={
            <>
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#FB923C]">Buat Game Baru</p>

              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F97316]/15">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[#FFF5F8]">Kamu jadi host</p>
                  <p className="text-xs text-[#5C5470]">Partner join pakai session code</p>
                </div>
              </div>

              {/* Total rounds toggle */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-[#9B93B0]">Jumlah Ronde</p>
                <div className="grid grid-cols-3 gap-2">
                  {([5, 7, 10] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setTotalRounds(n)}
                      className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                        totalRounds === n
                          ? "border-[#F97316]/50 bg-[#F97316]/15 text-[#FB923C]"
                          : "border-white/[0.07] text-[#5C5470] hover:border-white/20 hover:text-[#9B93B0]"
                      }`}
                    >
                      {n} Ronde<br />
                      <span className="text-[10px] font-normal opacity-70">{COIN_COSTS[n]} coin</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dare level */}
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-[#9B93B0]">Level Dare</p>
                <div className="flex flex-col gap-1.5">
                  {(["sweet_only", "mixed", "full_chaos"] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setDareLevel(level)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                        dareLevel === level
                          ? "border-[#F97316]/50 bg-[#F97316]/10 text-[#FFF5F8]"
                          : "border-white/[0.07] text-[#5C5470] hover:border-white/20 hover:text-[#9B93B0]"
                      }`}
                    >
                      {DARE_LEVEL_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={loadingCreate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(249,115,22,0.35)] transition hover:bg-[#FB923C] hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingCreate ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {loadingCreate ? "Membuat sesi..." : `🎲 Buat Sesi — ${COIN_COSTS[totalRounds]} Coin`}
              </button>
              <p className="mt-2 text-center text-[10px] text-[#5C5470]">Memotong {COIN_COSTS[totalRounds]} coin dari saldo kamu</p>
            </>
          }
          joinContent={
            <GameRulesList rules={[
              "Keduanya main mini-game yang sama serentak",
              "Yang dapat skor lebih rendah = kalah ronde",
              "Yang kalah harus lakukan dare dari partner!",
              "Selesaikan semua ronde untuk game over",
              "Banyak mini-game berbeda tiap rondenya",
            ]} />
          }
        />
      }
      // Playing content
      playingContent={
        session && gameState ? (
          <div className="flex flex-col gap-4">
            {/* Draw Toast */}
            {showDrawToast && (
              <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                <div className="animate-bounce-in bg-yellow-500/20 backdrop-blur-md border border-yellow-500/40 rounded-2xl px-8 py-5 flex flex-col items-center gap-2 shadow-2xl">
                  <span className="text-4xl">🤝</span>
                  <p className="text-lg font-bold text-yellow-300">Draw!</p>
                  <p className="text-sm text-yellow-400/80">Ronde diulang sekarang...</p>
                </div>
              </div>
            )}

            {/* Playing header */}
            <GamePlayingHeader
              sessionCode={session.session_code}
              statusText={`Ronde ${gameState.current_round}/${session.board_config.total_rounds}`}
              statusColor="#FFF5F8"
              timerSeconds={timerSeconds}
              timerTotalSeconds={20 * 60}
              partnerOnline={partnerOnline}
              showVideo={showVideo}
              onToggleVideo={() => setShowVideo(v => !v)}
              onLeave={handleReset}
              realtimeOk={realtimeOk}
            />

            {/* Score tracker */}
            <div className="grid grid-cols-2 gap-2">
              {(["host", "partner"] as const).map(role => {
                const label = role === myRole ? "Kamu" : "Partner";
                const dares = gameState.dare_counts[role];
                const skips = gameState.skip_counts[role];
                return (
                  <div key={role} className={`rounded-xl border p-3 text-center ${role === myRole ? "border-[#FF3D7F]/30 bg-[#FF3D7F]/5" : "border-white/10 bg-white/5"}`}>
                    <p className="text-xs text-[#5C5470]">{label}</p>
                    <p className="text-lg font-bold text-[#FFF5F8]">{dares} dare</p>
                    {skips > 0 && <p className="text-[10px] text-[#5C5470]">{skips}x skip</p>}
                  </div>
                );
              })}
            </div>

            {/* LOBBY phase */}
            {gameState.phase === "lobby" && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col items-center gap-5">
                <p className="text-base font-semibold text-[#FFF5F8]">Keduanya harus siap!</p>
                <div className="flex gap-8">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition ${gameState.ready.host ? "border-green-500 bg-green-500/20" : "border-white/20 bg-white/5"}`}>
                      {gameState.ready.host ? "✓" : "⏳"}
                    </div>
                    <p className="text-xs text-[#5C5470]">{myRole === "host" ? "Kamu" : "Partner"}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition ${gameState.ready.partner ? "border-green-500 bg-green-500/20" : "border-white/20 bg-white/5"}`}>
                      {gameState.ready.partner ? "✓" : "⏳"}
                    </div>
                    <p className="text-xs text-[#5C5470]">{myRole === "partner" ? "Kamu" : "Partner"}</p>
                  </div>
                </div>
                {!myReady ? (
                  <button
                    onClick={handleReadyUp}
                    disabled={readying}
                    className="w-full py-4 rounded-2xl bg-[#FF3D7F] hover:bg-[#FF6B9D] text-white font-bold text-lg transition disabled:opacity-50"
                  >
                    {readying ? "..." : "Siap! 🚀"}
                  </button>
                ) : (
                  <div className="text-sm text-[#9B93B0] animate-pulse">
                    {partnerReady ? "Memulai..." : "Menunggu partner..."}
                  </div>
                )}
                {gameState.is_replay_round && (
                  <p className="text-xs text-yellow-400">🔁 Draw! Ronde diulang</p>
                )}
              </div>
            )}

            {/* PLAYING phase */}
            {gameState.phase === "playing" && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                {submitted ? (
                  <div className="flex flex-col items-center gap-3 py-5">
                    {myRoundResult ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-5xl font-bold text-[#FFF5F8]">{myRoundResult.score}</span>
                        <span className="text-xs text-[#5C5470] uppercase tracking-widest">poin</span>
                        {bonusActive && (
                          <span className="text-xs text-yellow-400">✨ +50 bonus sudah diterapkan</span>
                        )}
                        <p className="text-xs text-[#5C5470] animate-pulse mt-2">⏳ Menunggu partner selesai...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-3xl animate-pulse">⏳</span>
                        <p className="text-sm text-[#9B93B0]">Menunggu partner...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {currentMiniGameId && (
                      <div className="mb-4 flex items-center gap-2">
                        <span className="text-lg">{MINIGAME_META[currentMiniGameId]?.emoji ?? "🎮"}</span>
                        <div>
                          <p className="text-sm font-semibold text-[#FFF5F8]">{MINIGAME_META[currentMiniGameId]?.name ?? currentMiniGameId}</p>
                          {bonusActive && <p className="text-xs text-yellow-400">+50 bonus aktif!</p>}
                        </div>
                      </div>
                    )}
                    {currentMiniGameId === "tap_timing" && (
                      <TapTimingGame
                        key={`${session.session_code}-${gameState.current_round}-${roundKey}`}
                        duration={MINIGAME_META.tap_timing.duration}
                        startedAt={roundStartedAtRef.current ?? undefined}
                        bonusActive={bonusActive}
                        onComplete={handleGameComplete}
                      />
                    )}
                    {currentMiniGameId === "reaction_btn" && (
                      <ReactionButtonGame
                        key={`${session.session_code}-${gameState.current_round}-${roundKey}`}
                        duration={MINIGAME_META.reaction_btn.duration}
                        startedAt={roundStartedAtRef.current ?? undefined}
                        bonusActive={bonusActive}
                        onComplete={handleGameComplete}
                      />
                    )}
                    {currentMiniGameId === "memory_seq" && (
                      <MemorySequenceGame
                        key={`${session.session_code}-${gameState.current_round}-${roundKey}`}
                        duration={MINIGAME_META.memory_seq.duration}
                        startedAt={roundStartedAtRef.current ?? undefined}
                        bonusActive={bonusActive}
                        onComplete={handleGameComplete}
                      />
                    )}
                    {currentMiniGameId === "word_scramble" && (
                      <WordScrambleGame
                        key={`${session.session_code}-${gameState.current_round}-${roundKey}`}
                        duration={MINIGAME_META.word_scramble.duration}
                        startedAt={roundStartedAtRef.current ?? undefined}
                        bonusActive={bonusActive}
                        onComplete={handleGameComplete}
                      />
                    )}
                    {currentMiniGameId === "true_false" && (
                      <TrueFalseGame
                        key={`${session.session_code}-${gameState.current_round}-${roundKey}`}
                        duration={MINIGAME_META.true_false.duration}
                        startedAt={roundStartedAtRef.current ?? undefined}
                        bonusActive={bonusActive}
                        onComplete={handleGameComplete}
                      />
                    )}
                    {currentMiniGameId === "number_order" && (
                      <NumberOrderGame
                        key={`${session.session_code}-${gameState.current_round}-${roundKey}`}
                        duration={MINIGAME_META.number_order.duration}
                        startedAt={roundStartedAtRef.current ?? undefined}
                        bonusActive={bonusActive}
                        onComplete={handleGameComplete}
                      />
                    )}
                    {currentMiniGameId && !MINIGAME_META[currentMiniGameId] && (
                      <div className="text-center py-8 text-[#5C5470]">Mini-game belum tersedia</div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* RESULT phase (dare) */}
            {gameState.phase === "result" && lastResult && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-[#5C5470] mb-3 uppercase tracking-wide">Hasil Ronde {lastResult.round_number}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["host", "partner"] as const).map(role => {
                      const score = role === "host" ? lastResult.host_score : lastResult.partner_score;
                      const isLoser = lastResult.loser === role;
                      const isWinner = lastResult.loser !== role && lastResult.loser !== "draw";
                      return (
                        <div key={role} className={`rounded-xl p-3 text-center ${isLoser ? "bg-red-500/10 border border-red-500/20" : isWinner ? "bg-green-500/10 border border-green-500/20" : "bg-white/5 border border-white/10"}`}>
                          <p className="text-xs text-[#5C5470]">{role === myRole ? "Kamu" : "Partner"}</p>
                          <p className="text-2xl font-bold text-[#FFF5F8]">{score}</p>
                          <p className="text-[10px] mt-1">{isLoser ? "😔 Kalah" : isWinner ? "🏆 Menang" : "🤝 Draw"}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {lastResult.loser !== "draw" && lastResult.dare_content && (
                  <div className="rounded-2xl border border-[#FF3D7F]/25 bg-[#FF3D7F]/5 p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      <p className="text-sm font-semibold text-[#FFF5F8]">
                        {amLoser ? "Dare untukmu!" : "Dare untuk partner!"}
                      </p>
                      <DareCategoryBadge category={lastResult.dare_category} />
                    </div>

                    <p className="text-[#FFF5F8] leading-relaxed">{lastResult.dare_content}</p>

                    {amLoser && dareStatus === "pending" && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleDareComplete}
                          disabled={daringAction}
                          className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold transition disabled:opacity-50"
                        >
                          {daringAction ? "..." : "Sudah Selesai ✅"}
                        </button>
                        <button
                          onClick={handleDareSkip}
                          disabled={daringAction}
                          className="w-full py-2 rounded-xl border border-white/10 text-[#5C5470] text-sm hover:text-[#9B93B0] transition disabled:opacity-50"
                        >
                          Skip ({gameState.skip_counts[myRole as "host" | "partner"] + 1}x)
                        </button>
                      </div>
                    )}

                    {amLoser && dareStatus === "awaiting_confirm" && (
                      <div className="text-center text-sm text-[#9B93B0] animate-pulse py-2">
                        Menunggu konfirmasi partner...
                      </div>
                    )}

                    {amWinner && dareStatus === "awaiting_confirm" && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDareConfirm(true)}
                          disabled={daringAction}
                          className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold transition disabled:opacity-50"
                        >
                          {daringAction ? "..." : "Ya, Sudah ✅"}
                        </button>
                        <button
                          onClick={() => handleDareConfirm(false)}
                          disabled={daringAction}
                          className="flex-1 py-3 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold transition disabled:opacity-50"
                        >
                          Belum 🔁
                        </button>
                      </div>
                    )}

                    {amWinner && dareStatus === "pending" && (
                      <div className="text-center text-sm text-[#9B93B0] animate-pulse py-2">
                        Menunggu partner menyelesaikan dare...
                      </div>
                    )}
                  </div>
                )}

                {lastResult.loser === "draw" && (
                  <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 p-4 text-center">
                    <p className="text-yellow-400 font-semibold">🤝 Draw! Ronde diulang</p>
                    <p className="text-xs text-[#5C5470] mt-1">Menunggu ronde berikutnya...</p>
                  </div>
                )}
              </div>
            )}

            {/* GAME OVER phase */}
            {gameState.phase === "game_over" && (
              <div className="text-center py-4 text-sm text-[#9B93B0] animate-pulse">
                Memuat hasil akhir...
              </div>
            )}

            {/* Surrender button */}
            <div className="mt-6">
              <GameSurrenderButton onClick={() => setShowSurrenderConfirm(true)} />
            </div>

            {/* Surrender confirm modal */}
            {showSurrenderConfirm && (
              <GameSurrenderModal
                hasWinner={true}
                warningText="Pasanganmu akan menang otomatis"
                onConfirm={handleSurrender}
                onCancel={() => setShowSurrenderConfirm(false)}
              />
            )}
          </div>
        ) : null
      }
      // Finished
      finishedContent={
        session ? (
          <GameFinishedCard
            gameName="Dare Derby"
            gameEmoji="🎲"
            finishType={
              finishReason === "completed"
                ? winner === "me" ? "win" : winner === "partner" ? "lose" : "draw"
                : finishReason === "time_up" ? "time_up" : "cancelled"
            }
            title={
              finishReason === "completed"
                ? winner === "me" ? "Kamu Menang!" : winner === "partner" ? "Partner Menang" : "Seri!"
                : finishReason === "time_up" ? "Waktu Habis" : "Sesi Berakhir"
            }
            subtitle={
              finishReason === "completed"
                ? `Kamu ${myDares} dare · Partner ${partnerDaresCount} dare`
                : finishReason === "time_up"
                ? "Sesi berakhir karena waktu habis"
                : "Sesi dibatalkan"
            }
            shareSummary={`${myDares} dare vs ${partnerDaresCount} dare · ${rounds.length} ronde`}
            onPlayAgain={handleReset}
            showKonfetti={winner === "me" && finishReason === "completed"}
            statsContent={
              <>
                {/* Round history */}
                {rounds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-[#5C5470] uppercase tracking-widest text-center mb-2">Rekap Ronde</p>
                    {rounds.map((r, i) => {
                      const status = r.loser === myRole ? "Kalah" : r.loser === "draw" ? "Draw" : "Menang";
                      const color   = r.loser === myRole ? "text-red-400" : r.loser === "draw" ? "text-yellow-400" : "text-green-400";
                      const icon    = r.loser === myRole ? "😔" : r.loser === "draw" ? "🤝" : "🏆";
                      return (
                        <div
                          key={i}
                          className={`grid grid-cols-[60px_1fr_72px] items-center gap-2 py-2 text-sm ${
                            i < rounds.length - 1 ? "border-b border-white/5" : ""
                          }`}
                        >
                          <span className="text-[#5C5470] text-xs">Ronde {r.round_number}</span>
                          <span className="text-[#9B93B0] text-xs text-center">{MINIGAME_META[r.minigame_id]?.name ?? r.minigame_id}</span>
                          <span className={`${color} text-xs font-semibold text-right flex items-center justify-end gap-1`}>
                            {icon} {status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Dare kamu</span>
                  <span className="font-bold text-[#FFF5F8]">{myDares}</span>
                </div>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Dare partner</span>
                  <span className="font-bold text-[#FFF5F8]">{partnerDaresCount}</span>
                </div>
              </>
            }
          />
        ) : null
      }
    />
  );
}

export default function DareDerbyPage() {
  return (
    <Suspense fallback={<GamePageSkeleton />}>
      <DareDerbyContent />
    </Suspense>
  );
}
