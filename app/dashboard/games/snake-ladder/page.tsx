"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { PhaserBoard } from "@/components/games/snake-ladder/PhaserBoard";
import { Dice } from "@/components/games/snake-ladder/Dice";
import { ChallengeModal } from "@/components/games/snake-ladder/ChallengeModal";
import { toast } from "@/components/ui/Toast";
import { sendBrowserNotification, requestNotificationPermission } from "@/lib/notifications";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { GamePageLayout, GamePageSkeleton } from "@/components/games/GamePageLayout";
import { GamePlayingHeader } from "@/components/games/GamePlayingHeader";
import { GameFinishedCard } from "@/components/games/GameFinishedCard";
import { GameIdleLayout, GameRulesList } from "@/components/games/GameIdleLayout";
import { GameSurrenderModal, GameSurrenderButton } from "@/components/games/GameSurrenderModal";
import type { SnakeSession, SnakeGameState } from "@/lib/types";

// ── Custom Select ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "romantis",  label: "Romantis",  emoji: "💕" },
  { value: "kenangan",  label: "Kenangan",  emoji: "🌸" },
  { value: "harapan",   label: "Harapan",   emoji: "✨" },
  { value: "seru",      label: "Seru",      emoji: "🔥" },
  { value: "umum",      label: "Umum",      emoji: "🎯" },
];

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#18181C] px-3 py-2.5 text-xs text-[#FFF5F8] transition hover:border-[#818CF8]/40"
      >
        <span className="flex items-center gap-2">
          <span>{selected.emoji}</span>
          <span>{selected.label}</span>
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5C5470" strokeWidth="2.5"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#18181C] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => { onChange(c.value); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition hover:bg-white/5 ${
                c.value === value ? "text-[#818CF8] bg-[#818CF8]/8" : "text-[#9B93B0]"
              }`}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
              {c.value === value && (
                <svg className="ml-auto" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tipe Phase ─────────────────────────────────────────────────────────────────
type Phase = "idle" | "waiting" | "playing" | "finished";
type FinishReason = "time_up" | "completed" | "expired" | null;

// ── Main Page ──────────────────────────────────────────────────────────────────
function SnakeGameContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [joinCodeInput, setJoinCodeInput] = useState(
    searchParams?.get("join")?.toUpperCase() ?? ""
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<SnakeSession | null>(null);
  const [finishReason, setFinishReason] = useState<FinishReason>(null);

  // Setup state (sebelum buat sesi)
  const [useAI, setUseAI] = useState(false);
  const [aiType, setAiType] = useState<"truth" | "dare" | "mix">("mix");
  const [aiCategory, setAiCategory] = useState("romantis");
  const [aiNarasi, setAiNarasi] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<Array<{ type: string; question: string; category: string }> | null>(null);
  const [aiPreview, setAiPreview] = useState(false);

  // Game state
  const [gameState, setGameState] = useState<SnakeGameState | null>(null);
  const [diceValue, setDiceValue] = useState(1);
  const [diceRolling, setDiceRolling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  // Video call
  const [showVideo, setShowVideo] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Pre-join lobby
  const [preJoinCode, setPreJoinCode] = useState<string | null>(null);

  // Challenge modal is only shown after pion animation completes
  const [challengeReady, setChallengeReady] = useState(true);

  // Realtime
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const myRole = session
    ? session.host_user_id === user?.id ? "host" : "partner"
    : null;

  // ── Timer expire ──────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (!session) return;
    setFinishReason("time_up");
    setPhase("finished");
    fetch(`/api/game/snake-ladder/session/${session.session_code}/expire`, { method: "POST" }).catch(() => {});
  }, [session]);

  const timerSeconds = useCountdown(
    phase === "playing" ? session?.expires_at ?? null : null,
    handleTimerExpire
  );

  // ── Apply session dari server ─────────────────────────────────────────────
  const applySession = useCallback((s: SnakeSession | null) => {
    if (!s) {
      setSession(null);
      setPhase("idle");
      return;
    }

    const isExpiredByTime =
      s.status === "playing" && !!s.expires_at && new Date(s.expires_at) < new Date();

    if (s.status === "completed" || s.status === "expired" || s.status === "cancelled" || isExpiredByTime) {
      setSession(s);
      setGameState(s.game_state as SnakeGameState);
      setFinishReason(
        s.status === "expired" || isExpiredByTime
          ? "time_up"
          : s.game_state?.winner
          ? "completed"
          : "expired"
      );
      setPhase("finished");
      return;
    }

    setSession(s);
    setGameState(s.game_state as SnakeGameState);
    if (s.status === "waiting") setPhase("waiting");
    else if (s.status === "playing") {
      if (prevStatusRef.current === "waiting") {
        sendBrowserNotification("Partner sudah bergabung! 🎲", {
          body: "Game Snake & Ladder siap dimulai!",
          tag: "partner-join",
        });
      }
      setPhase("playing");
    }
    prevStatusRef.current = s.status;
  }, []);

  // ── Load sesi aktif on mount ──────────────────────────────────────────────
  useEffect(() => {
    const urlCode = (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("join")
      : null
    )?.toUpperCase() ?? "";

    if (urlCode) {
      window.history.replaceState({}, "", window.location.pathname);
      setJoinCodeInput(urlCode);
      setPreJoinCode(urlCode);
      setPhase("waiting");
      return;
    }

    fetch("/api/game/snake-ladder/session/active")
      .then((r) => r.json())
      .then((res) => {
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

  // ── Supabase Realtime subscription ───────────────────────────────────────
  useEffect(() => {
    if (!session?.session_code) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setPartnerOnline(false);
      return;
    }

    const code = session.session_code;
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`snake:${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `session_code=eq.${code}` },
        (payload) => {
          const updated = payload.new as SnakeSession;
          applySession(updated);
          const gs = updated.game_state as SnakeGameState;
          if (gs?.last_roll) setDiceValue(gs.last_roll.dice);
          setGameState(gs);
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const users = Object.values(state).flat();
        setPartnerOnline(users.some((p) => p.user_id !== user?.id));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeOk(true);
          if (user?.id) await channel.track({ user_id: user.id });
          const res = await fetch(`/api/game/snake-ladder/session/${code}`);
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleGenerateAI() {
    setGeneratingAI(true);
    try {
      const res = await fetch("/api/game/snake-ladder/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: aiType, category: aiCategory, narasi: aiNarasi, count: 15 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setAiQuestions(data.data.questions);
      setAiPreview(true);
    } catch (e) {
      toast.error("Gagal generate pertanyaan", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setGeneratingAI(false);
    }
  }

  async function handleCreateSession() {
    setLoadingCreate(true);
    setError(null);
    try {
      const body: { custom_questions?: typeof aiQuestions } = {};
      if (useAI && aiQuestions && aiQuestions.length >= 15) {
        body.custom_questions = aiQuestions;
      }

      const res = await fetch("/api/game/snake-ladder/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      applySession(data.data.session);
      toast.success("Board siap!", "Bagikan kode sesi ke partner dan tunggu mereka bergabung.");
      requestNotificationPermission();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal membuat sesi";
      toast.error("Gagal membuat sesi", msg);
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleJoin() {
    const code = (preJoinCode ?? joinCodeInput).trim();
    if (!code) return;
    setLoadingJoin(true);
    setError(null);
    try {
      const res = await fetch("/api/game/snake-ladder/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPreJoinCode(null);
      applySession(data.data.session);
      toast.success("Berhasil bergabung!", "Game akan segera dimulai.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal bergabung";
      toast.error("Gagal bergabung", msg);
    } finally {
      setLoadingJoin(false);
    }
  }

  async function handleRoll() {
    if (!session || !gameState || diceRolling) return;
    if (gameState.current_turn !== myRole) return;
    if (gameState.pending_challenge) return;

    setDiceRolling(true);
    setError(null);

    await new Promise((r) => setTimeout(r, 600));

    try {
      const res = await fetch(`/api/game/snake-ladder/session/${session.session_code}/roll`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const gs = data.data.game_state as SnakeGameState;
      setGameState(gs);
      if (gs.last_roll) setDiceValue(gs.last_roll.dice);
    } catch (e) {
      toast.error("Gagal lempar dadu", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setDiceRolling(false);
    }
  }

  async function handleConfirmChallenge() {
    if (!session) return;
    setIsConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/snake-ladder/session/${session.session_code}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setGameState(data.data.game_state);
    } catch (e) {
      toast.error("Gagal konfirmasi", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setIsConfirming(false);
    }
  }

  const handleMoveDone = useCallback(() => {
    setChallengeReady(true);
  }, []);

  useEffect(() => {
    if (phase === "playing") setChallengeReady(false);
  }, [gameState?.host_position, gameState?.partner_position]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewGame() {
    if (session?.status === "waiting" && session.host_user_id === user?.id) {
      fetch(`/api/game/session/${session.session_code}/cancel`, { method: "POST" }).catch(() => {});
    }
    setSession(null);
    setGameState(null);
    setPhase("idle");
    setFinishReason(null);
    setAiQuestions(null);
    setAiPreview(false);
    setUseAI(false);
    setDiceValue(1);
    setShowVideo(false);
    setError(null);
    setShowConfirm(false);
    setPreJoinCode(null);
    setShowSurrenderConfirm(false);
  }

  async function handleSurrender() {
    if (!session) return;
    try {
      const res = await fetch(`/api/game/snake-ladder/session/${session.session_code}/surrender`, { method: "POST" });
      const data = await res.json().catch(() => ({ success: false, message: "Gagal menyerah" }));
      if (!data.success) {
        toast.error("Gagal menyerah", data.message ?? "Terjadi kesalahan");
        return;
      }
      if (data.data?.game_state) setGameState(data.data.game_state);
      setFinishReason("completed");
      setPhase("finished");
    } catch (e) {
      toast.error("Gagal menyerah", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setShowSurrenderConfirm(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isMyTurn = gameState?.current_turn === myRole;
  const hasPendingChallenge = !!gameState?.pending_challenge;
  const lastRoll = gameState?.last_roll;
  const totalSec = 20 * 60;
  const gs = gameState;
  const winnerIsMe = gs?.winner === myRole;
  const partnerWon = !!(gs?.winner && gs.winner !== myRole);

  // Pre-join logic
  const isHostUser = !!(session && user && session.host_user_id === user.id);
  const isPartnerPreJoin = !!(preJoinCode && !session);
  const displayCode = session?.session_code ?? preJoinCode ?? "";

  return (
    <GamePageLayout
      gameName="Snake & Ladder"
      gameEmoji="🎲"
      gameSlug="snake-ladder"
      gameSubtitle="Board klasik dengan Truth or Dare di setiap kotak!"
      accentColor="#818CF8"
      accentColorLight="#A78BFA"
      phase={phase}
      // Waiting
      sessionCode={displayCode}
      isHost={!isPartnerPreJoin && isHostUser}
      onCancel={handleNewGame}
      onJoin={(!isHostUser || isPartnerPreJoin) ? handleJoin : undefined}
      joinLoading={loadingJoin}
      expiryMinutes={20}
      // Playing
      realtimeOk={realtimeOk}
      showVideo={showVideo}
      videoSessionCode={session?.session_code}
      videoGame="snake-ladder"
      onVideoLeave={() => setShowVideo(false)}
      // Idle
      idleContent={
        <>
          <GameIdleLayout
            accentColor="#818CF8"
            accentColorLight="#A78BFA"
            joinCodeInput={joinCodeInput}
            onJoinCodeChange={setJoinCodeInput}
            onJoin={handleJoin}
            joinLoading={loadingJoin}
            createContent={
              <>
                <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#818CF8]">Buat Game Baru</p>

                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#818CF8]/15">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[#FFF5F8]">Kamu jadi host</p>
                    <p className="text-xs text-[#5C5470]">Partner join pakai session code</p>
                  </div>
                </div>

                {/* Toggle pertanyaan */}
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.07] p-3">
                  <button
                    onClick={() => setUseAI(false)}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${!useAI ? "bg-[#818CF8] text-white" : "text-[#5C5470] hover:text-[#9B93B0]"}`}
                  >
                    Default (acak 15)
                  </button>
                  <button
                    onClick={() => setUseAI(true)}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${useAI ? "bg-[#818CF8] text-white" : "text-[#5C5470] hover:text-[#9B93B0]"}`}
                  >
                    ✨ Custom AI
                  </button>
                </div>

                {useAI && (
                  <div className="mb-4 space-y-3">
                    <div className="flex gap-2">
                      {(["truth", "dare", "mix"] as const).map((t) => (
                        <button key={t} onClick={() => setAiType(t)}
                          className={`flex-1 rounded-xl border py-2 text-xs font-semibold capitalize transition ${aiType === t ? "border-[#818CF8]/50 bg-[#818CF8]/15 text-[#818CF8]" : "border-white/[0.07] text-[#5C5470] hover:border-white/20"}`}>
                          {t === "mix" ? "Campuran" : t}
                        </button>
                      ))}
                    </div>
                    <CategorySelect value={aiCategory} onChange={setAiCategory} />

                    <div>
                      <label className="block text-[10px] font-medium text-[#5C5470] mb-1.5">
                        Ceritakan ke AI kamu mau pertanyaan seperti apa <span className="text-[#5C5470]">(opsional)</span>
                      </label>
                      <textarea
                        value={aiNarasi}
                        onChange={(e) => setAiNarasi(e.target.value)}
                        placeholder={`Contoh: "Aku mau pertanyaan seputar kenangan pertama kita ketemu, momen-momen awal jadian, dan hal-hal yang bikin aku jatuh cinta"`}
                        rows={3}
                        maxLength={300}
                        className="w-full rounded-xl border border-white/10 bg-[#18181C] px-3 py-2.5 text-xs text-[#FFF5F8] outline-none placeholder:text-[#3a3650] focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20 resize-none transition leading-relaxed"
                      />
                      <p className="mt-1 text-right text-[10px] text-[#3a3650]">{aiNarasi.length}/300</p>
                    </div>

                    {aiQuestions && aiPreview ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-[#34D399]">✓ {aiQuestions.length} pertanyaan siap</p>
                          <button onClick={() => { setAiQuestions(null); setAiPreview(false); }}
                            className="text-[10px] text-[#5C5470] hover:text-red-400">Hapus</button>
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1">
                          {aiQuestions.slice(0, 5).map((q, i) => (
                            <p key={i} className="text-[10px] text-[#5C5470] truncate">
                              <span className={`font-semibold ${q.type === "dare" ? "text-[#FF6B9D]" : "text-[#818CF8]"}`}>{q.type}</span>: {q.question}
                            </p>
                          ))}
                          {aiQuestions.length > 5 && <p className="text-[10px] text-[#5C5470]">+{aiQuestions.length - 5} lainnya...</p>}
                        </div>
                      </div>
                    ) : (
                      <button onClick={handleGenerateAI} disabled={generatingAI}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#818CF8]/10 border border-[#818CF8]/20 px-4 py-2.5 text-xs font-semibold text-[#818CF8] transition hover:bg-[#818CF8]/20 disabled:opacity-50">
                        {generatingAI ? (
                          <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>Generate...</>
                        ) : "✨ Generate Pertanyaan AI"}
                      </button>
                    )}
                  </div>
                )}

                <button onClick={() => setShowConfirm(true)}
                  disabled={useAI && !aiQuestions}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#818CF8] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(129,140,248,0.35)] transition hover:bg-[#A78BFA] disabled:opacity-50 disabled:cursor-not-allowed">
                  {useAI && !aiQuestions ? "Generate pertanyaan dulu" : "Siapkan Board →"}
                </button>
                <p className="mt-2 text-[10px] text-[#5C5470] text-center">Memotong 5 coin</p>
              </>
            }
            joinContent={
              <GameRulesList rules={[
                "Lempar dadu & gerakkan pion",
                "Dadu 6 → lempar lagi!",
                "Kotak ⚡/✦ = Truth or Dare wajib",
                "Partner harus konfirmasi tantangan selesai",
                "Harus TEPAT angka 100 untuk menang",
                "Kena ular 🐍 turun, naik tangga 🪜 loncat",
              ]} />
            }
          />

          {/* ── Confirm Modal ──────────────────────────────────────────────────── */}
          {showConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => !loadingCreate && setShowConfirm(false)}
              />
              <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#818CF8]/25 bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
                <div className="h-0.5 w-full bg-linear-to-r from-[#818CF8] to-[#A78BFA]" />
                <div className="p-6">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#818CF8]">Konfirmasi</p>
                  <h2 className="mt-1 text-xl font-bold text-[#FFF5F8]">Mulai game baru?</h2>
                </div>
                <div className="space-y-2.5 mb-6 text-sm text-[#9B93B0]">
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    Board 10×10 akan di-generate secara random
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    {useAI && aiQuestions ? `${aiQuestions.length} pertanyaan AI siap dipakai` : "15 pertanyaan random dari pool"}
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    <span><span className="font-semibold text-[#FF6B9D]">5 coin</span> akan dipotong</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    Durasi game: <span className="font-semibold text-[#FFF5F8]">20 menit</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={loadingCreate}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSession}
                    disabled={loadingCreate}
                    className="flex-1 rounded-xl bg-[#818CF8] py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(129,140,248,0.35)] transition hover:bg-[#A78BFA] disabled:opacity-50"
                  >
                    {loadingCreate ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                        </svg>
                        Membuat...
                      </span>
                    ) : "Buat Game!"}
                  </button>
                </div>
                </div>
              </div>
            </div>
          )}
        </>
      }
      // Playing
      playingContent={
        session && gameState ? (
          <>
            <GamePlayingHeader
              sessionCode={session.session_code}
              statusText={hasPendingChallenge ? "⚡ Tantangan aktif" : isMyTurn ? "Giliranmu" : "Giliran partner"}
              statusColor={hasPendingChallenge ? "#FBBF24" : isMyTurn ? "#818CF8" : "#9B93B0"}
              timerSeconds={timerSeconds}
              timerTotalSeconds={totalSec}
              partnerOnline={partnerOnline}
              showVideo={showVideo}
              onToggleVideo={() => setShowVideo((v) => !v)}
              onLeave={handleNewGame}
              realtimeOk={realtimeOk}
            />

            <div className="flex flex-col lg:flex-row items-start gap-3">
              {/* Board */}
              <div className="w-full lg:w-[500px] shrink-0">
                <PhaserBoard
                  boardConfig={session.board_config}
                  gameState={gameState}
                  hostUserId={session.host_user_id}
                  currentUserId={user?.id ?? ""}
                  onMoveDone={handleMoveDone}
                />
              </div>

              {/* Side panel */}
              <div className="flex-1 w-full space-y-3">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 items-start">
                  {/* Dice panel */}
                  <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-3 sm:p-4 flex flex-col items-center gap-2">
                    <Dice
                      value={diceValue}
                      rolling={diceRolling}
                      disabled={!isMyTurn || hasPendingChallenge || diceRolling}
                      onRoll={handleRoll}
                    />
                  </div>

                  {/* Score board */}
                  <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-3 sm:p-4">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">POSISI</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="h-2 w-2 shrink-0 rounded-full bg-[#FF3D7F]" />
                          <span className="truncate text-[11px] text-[#9B93B0]">
                            {myRole === "host" ? "Kamu" : "Host"}
                          </span>
                        </div>
                        <span className="ml-1 shrink-0 font-mono text-sm font-black text-[#FFF5F8]">
                          {gameState.host_position === 0 ? "—" : gameState.host_position}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="h-2 w-2 shrink-0 rounded-full bg-[#818CF8]" />
                          <span className="truncate text-[11px] text-[#9B93B0]">
                            {myRole === "partner" ? "Kamu" : "Partner"}
                          </span>
                        </div>
                        <span className="ml-1 shrink-0 font-mono text-sm font-black text-[#FFF5F8]">
                          {gameState.partner_position === 0 ? "—" : gameState.partner_position}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2.5 space-y-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-[#FF3D7F] transition-all duration-500"
                          style={{ width: `${gameState.host_position}%` }} />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-[#818CF8] transition-all duration-500"
                          style={{ width: `${gameState.partner_position}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Last roll info */}
                {lastRoll && (
                  <div className="overflow-hidden rounded-xl bg-white/5 px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[10px] text-[#5C5470]">
                        {lastRoll.player === myRole ? "Kamu" : "Partner"} dapat angka
                      </p>
                      <span className="shrink-0 font-black text-[#FFF5F8] text-base leading-none">{lastRoll.dice}</span>
                    </div>
                    {lastRoll.snake_from && (
                      <p className="text-[10px] text-red-400">🐍 Turun {lastRoll.snake_from} → {lastRoll.final}</p>
                    )}
                    {lastRoll.ladder_from && (
                      <p className="text-[10px] text-[#22C55E]">🪜 Naik {lastRoll.ladder_from} → {lastRoll.final}</p>
                    )}
                    {lastRoll.bounced && (
                      <p className="text-[10px] text-yellow-400">↩ Balik ke {lastRoll.final}</p>
                    )}
                    {lastRoll.dice === 6 && !lastRoll.bounced && (
                      <p className="text-[10px] text-yellow-400">★ Dapat 6 — lempar lagi!</p>
                    )}
                  </div>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={handleRoll}
                  disabled={!isMyTurn || hasPendingChallenge || diceRolling}
                  className={`w-full rounded-2xl border py-3 text-sm font-semibold transition ${
                    hasPendingChallenge
                      ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-400 cursor-default"
                      : isMyTurn && !diceRolling
                      ? "border-[#818CF8]/30 bg-[#818CF8]/10 text-[#818CF8] hover:bg-[#818CF8]/20"
                      : "border-white/[0.07] bg-white/[0.02] text-[#5C5470] cursor-default"
                  }`}
                >
                  {hasPendingChallenge
                    ? "⚡ Selesaikan tantangan dulu"
                    : isMyTurn
                    ? "🎲 Lempar dadu sekarang!"
                    : "⏳ Giliran partner..."}
                </button>
              </div>
            </div>
            {/* Challenge Modal */}
            {hasPendingChallenge && gameState.pending_challenge && myRole && challengeReady && (
              <ChallengeModal
                challenge={gameState.pending_challenge}
                myRole={myRole}
                isConfirming={isConfirming}
                onConfirm={handleConfirmChallenge}
              />
            )}

            {/* Surrender button */}
            <div className="mt-4">
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
          </>
        ) : null
      }
      // Finished
      finishedContent={
        session && gameState ? (
          <GameFinishedCard
            gameName="Ular Tangga"
            gameEmoji="🎲"
            finishType={finishReason === "time_up" ? "time_up" : winnerIsMe ? "win" : partnerWon ? "lose" : "complete"}
            title={finishReason === "time_up" ? "Waktu Habis!" : winnerIsMe ? "Kamu Menang!" : partnerWon ? "Pasanganmu Menang!" : "Game Selesai"}
            subtitle={
              finishReason === "time_up"
                ? "Waktu 20 menit sudah habis."
                : winnerIsMe
                ? "Selamat! Kamu berhasil mencapai kotak 100 tepat!"
                : partnerWon
                ? "Pasanganmu mencapai kotak 100 duluan. Semangat!"
                : "Game selesai."
            }
            shareSummary={`Posisi akhir: ${gameState.host_position} vs ${gameState.partner_position}`}
            onPlayAgain={handleNewGame}
            statsContent={
              <>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Posisi Host</span>
                  <span className="font-mono font-bold text-[#FF3D7F]">{gameState.host_position === 100 ? "100 🏆" : gameState.host_position}</span>
                </div>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Posisi Partner</span>
                  <span className="font-mono font-bold text-[#818CF8]">{gameState.partner_position === 100 ? "100 🏆" : gameState.partner_position}</span>
                </div>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Session</span>
                  <span className="font-mono text-[#9B93B0]">{session.session_code}</span>
                </div>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Hasil</span>
                  <span className="font-medium" style={{ color: finishReason === "time_up" ? "#FBBF24" : winnerIsMe ? "#34D399" : "#818CF8" }}>
                    {finishReason === "time_up" ? "Waktu Habis" : winnerIsMe ? "Menang" : partnerWon ? "Kalah" : "Seri"}
                  </span>
                </div>
              </>
            }
          />
        ) : null
      }
    />
  );
}

// ── Wrapper with Suspense ──────────────────────────────────────────────────────
export default function SnakeGamePage() {
  return (
    <Suspense fallback={<GamePageSkeleton />}>
      <SnakeGameContent />
    </Suspense>
  );
}
