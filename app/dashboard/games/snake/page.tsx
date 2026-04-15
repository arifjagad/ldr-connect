"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { SnakeBoard } from "@/components/snake/SnakeBoard";
import { Dice } from "@/components/snake/Dice";
import { ChallengeModal } from "@/components/snake/ChallengeModal";
import type { SnakeSession, SnakeGameState } from "@/lib/types";

// ── Timer ─────────────────────────────────────────────────────────────────────
function useCountdown(targetISO: string | null, onExpire: () => void) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!targetISO) return;
    calledRef.current = false;

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(targetISO).getTime() - Date.now()) / 1000));
      setSeconds(diff);
      if (diff === 0 && !calledRef.current) {
        calledRef.current = true;
        onExpire();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO, onExpire]);

  return seconds;
}

function formatTime(s: number | null) {
  if (s === null) return "--:--";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── Tipe Phase ─────────────────────────────────────────────────────────────────
type Phase = "idle" | "setup" | "waiting" | "playing" | "finished";
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
  const [aiError, setAiError] = useState<string | null>(null);
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
  const dailyRef = useRef<HTMLIFrameElement>(null);

  // Realtime
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const myRole = session
    ? session.host_user_id === user?.id ? "host" : "partner"
    : null;

  // ── Timer expire ──────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (!session) return;
    setFinishReason("time_up");
    setPhase("finished");
    fetch(`/api/game/snake/session/${session.session_code}/expire`, { method: "POST" }).catch(() => {});
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
    else if (s.status === "playing") setPhase("playing");
  }, []);

  // ── Load sesi aktif on mount ──────────────────────────────────────────────
  useEffect(() => {
    const urlCode = (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("join")
      : null
    )?.toUpperCase() ?? "";

    if (urlCode) {
      // Datang dari join link — langsung coba join
      fetch("/api/game/snake/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: urlCode }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            applySession(res.data.session);
          } else {
            // Mungkin sudah tergabung sebelumnya — cek sesi aktif
            fetch("/api/game/snake/session/active")
              .then((r) => r.json())
              .then((r2) => { if (r2.data?.session) applySession(r2.data.session); })
              .catch(() => {});
          }
        })
        .catch(() => {});
      return;
    }

    // Tidak ada join code di URL — cek sesi aktif milik couple
    fetch("/api/game/snake/session/active")
      .then((r) => r.json())
      .then((res) => {
        const s = res.data?.session;
        if (!s) return;
        // Jika sesi masih waiting tapi user bukan host (user = partner yang belum join)
        // → pre-fill join code dan tetap di idle agar mereka bisa join
        if (s.status === "waiting" && user?.id && s.host_user_id !== user.id) {
          setJoinCodeInput(s.session_code);
          return;
        }
        applySession(s);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase Realtime subscription ───────────────────────────────────────
  useEffect(() => {
    if (!session?.session_code || phase === "idle" || phase === "setup" || phase === "finished") {
      channelRef.current?.unsubscribe();
      return;
    }

    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`snake:${session.session_code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `session_code=eq.${session.session_code}`,
        },
        (payload) => {
          const updated = payload.new as SnakeSession;
          applySession(updated);

          // Jika partner baru join (partner_user_id terisi), pindah ke playing
          if (updated.status === "playing" && phase === "waiting") {
            setPhase("playing");
          }

          // Sync dice value dari last_roll
          const gs = updated.game_state as SnakeGameState;
          if (gs?.last_roll) {
            setDiceValue(gs.last_roll.dice);
          }
          setGameState(gs);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [session?.session_code, phase, applySession]);

  // ── Polling fallback saat waiting (5s) dan playing (2s) ─────────────────
  useEffect(() => {
    const isWaiting = phase === "waiting";
    const isPlaying = phase === "playing";
    if ((!isWaiting && !isPlaying) || !session?.session_code) return;

    const interval = isPlaying ? 2000 : 5000;

    const id = setInterval(async () => {
      const res = await fetch(`/api/game/snake/session/${session.session_code}`);
      const data = await res.json();
      if (data.data?.session) applySession(data.data.session);
    }, interval);

    return () => clearInterval(id);
  }, [phase, session?.session_code, applySession]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleGenerateAI() {
    setGeneratingAI(true);
    setAiError(null);
    try {
      const res = await fetch("/api/game/snake/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: aiType, category: aiCategory, narasi: aiNarasi, count: 15 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setAiQuestions(data.data.questions);
      setAiPreview(true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Gagal generate pertanyaan");
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

      const res = await fetch("/api/game/snake/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      applySession(data.data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat sesi");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleJoin() {
    if (!joinCodeInput.trim()) return;
    setLoadingJoin(true);
    setError(null);
    try {
      const res = await fetch("/api/game/snake/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCodeInput.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      applySession(data.data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal bergabung");
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

    // Animasi dadu sebentar
    await new Promise((r) => setTimeout(r, 600));

    try {
      const res = await fetch(`/api/game/snake/session/${session.session_code}/roll`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const gs = data.data.game_state as SnakeGameState;
      setGameState(gs);
      if (gs.last_roll) setDiceValue(gs.last_roll.dice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal lempar dadu");
    } finally {
      setDiceRolling(false);
    }
  }

  async function handleConfirmChallenge() {
    if (!session) return;
    setIsConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/snake/session/${session.session_code}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setGameState(data.data.game_state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal konfirmasi");
    } finally {
      setIsConfirming(false);
    }
  }

  function handleNewGame() {
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
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // IDLE
  if (phase === "idle") {
    return (
      <main className="relative mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
        <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full blur-[100px]"
          style={{ background: "radial-gradient(ellipse, rgba(129,140,248,0.12) 0%, transparent 70%)" }} />

        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Games / Ular Tangga</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#FFF5F8]">
            Snake &{" "}
            <span style={{ backgroundImage: "linear-gradient(90deg, #818CF8, #A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Ladder
            </span>
          </h1>
          <p className="mt-2 text-sm text-[#9B93B0]">Board klasik dengan tantangan Truth or Dare di setiap kotak. Harus tepat angka 100 untuk menang!</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Buat Game */}
          <div className="rounded-2xl border border-[#818CF8]/20 bg-[#111113] p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#818CF8]">Buat Game Baru</p>

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
                <select
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#18181C] px-3 py-2 text-xs text-[#FFF5F8] outline-none"
                >
                  {["romantis", "kenangan", "harapan", "seru", "umum"].map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>

                {/* Narasi / konteks khusus untuk AI */}
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
                {aiError && <p className="text-[10px] text-red-400">{aiError}</p>}
              </div>
            )}

            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

            <button onClick={() => setPhase("setup")}
              disabled={useAI && !aiQuestions}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#818CF8] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(129,140,248,0.35)] transition hover:bg-[#A78BFA] disabled:opacity-50 disabled:cursor-not-allowed">
              {useAI && !aiQuestions ? "Generate pertanyaan dulu" : "Siapkan Board →"}
            </button>
            <p className="mt-2 text-[10px] text-[#5C5470] text-center">Memotong 5 coin</p>
          </div>

          {/* Join Game */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#5C5470]">Gabung Game</p>
            <input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="Masukkan kode sesi"
              maxLength={12}
              className="w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-3 font-mono text-base font-bold tracking-widest text-[#FFF5F8] outline-none placeholder:text-[#5C5470] placeholder:font-normal placeholder:tracking-normal focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20"
            />
            <button onClick={handleJoin} disabled={loadingJoin || !joinCodeInput.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#818CF8]/30 bg-[#818CF8]/10 px-5 py-3 text-sm font-bold text-[#818CF8] transition hover:bg-[#818CF8]/20 disabled:opacity-50">
              {loadingJoin ? "Bergabung..." : "Bergabung"}
            </button>

            {/* Info rules */}
            <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5C5470]">Cara Main</p>
              {[
                "Lempar dadu & gerakkan pion",
                "Dadu 6 → lempar lagi!",
                "Kotak ⚡/✦ = Truth or Dare wajib",
                "Partner harus konfirmasi tantangan selesai",
                "Harus TEPAT angka 100 untuk menang",
                "Kena ular 🐍 turun, naik tangga 🪜 loncat",
              ].map((rule, i) => (
                <p key={i} className="flex items-start gap-2 text-[10px] text-[#9B93B0]">
                  <span className="mt-0.5 text-[#5C5470]">•</span> {rule}
                </p>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // SETUP (konfirmasi sebelum create)
  if (phase === "setup") {
    return (
      <main className="relative mx-auto w-full max-w-md px-6 py-12 lg:px-8">
        <div className="rounded-2xl border border-[#818CF8]/20 bg-[#111113] p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#818CF8]">Konfirmasi</p>
          <h2 className="text-xl font-bold text-[#FFF5F8] mb-4">Mulai game baru?</h2>
          <div className="space-y-2 mb-6 text-sm text-[#9B93B0]">
            <p>• Board 10×10 akan di-generate secara random</p>
            <p>• {useAI && aiQuestions ? `${aiQuestions.length} pertanyaan AI siap dipakai` : "15 pertanyaan random dari pool"}</p>
            <p>• <span className="text-[#FF6B9D] font-semibold">5 coin</span> akan dipotong</p>
            <p>• Durasi game: <span className="font-semibold text-[#FFF5F8]">20 menit</span></p>
          </div>
          {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setPhase("idle")}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-[#9B93B0] transition hover:text-[#FFF5F8]">
              Batal
            </button>
            <button onClick={handleCreateSession} disabled={loadingCreate}
              className="flex-1 rounded-xl bg-[#818CF8] py-2.5 text-sm font-bold text-white transition hover:bg-[#A78BFA] disabled:opacity-50">
              {loadingCreate ? "Membuat..." : "Buat Game!"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // WAITING
  if (phase === "waiting" && session) {
    const shareText = `Yuk main Ular Tangga bareng aku di LDR-Connect! 🎲\nKode: ${session.session_code}\nLink: ${typeof window !== "undefined" ? window.location.origin : ""}/join/${session.session_code}`;

    return (
      <main className="relative mx-auto w-full max-w-md px-6 py-12 lg:px-8">
        <div className="rounded-2xl border border-[#818CF8]/20 bg-[#111113] p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#818CF8]/15">
            <span className="text-3xl">🎲</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-[#5C5470] mb-2">Menunggu partner bergabung</p>
          <p className="font-mono text-3xl font-black tracking-[0.2em] text-[#818CF8] mb-1">{session.session_code}</p>
          <p className="text-xs text-[#5C5470] mb-5">Bagikan kode ini ke pasanganmu</p>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366]/15 border border-[#25D366]/20 px-5 py-2.5 text-sm font-semibold text-[#25D366] transition hover:bg-[#25D366]/25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Kirim via WhatsApp
          </a>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#5C5470]">
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
            Menunggu partner...
          </div>
        </div>
      </main>
    );
  }

  // FINISHED
  if (phase === "finished" && session && gameState) {
    const gs = gameState;
    const winnerIsMe = gs.winner === myRole;
    const partnerWon = gs.winner && gs.winner !== myRole;
    const isDraw = !gs.winner;

    return (
      <main className="relative mx-auto w-full max-w-md px-6 py-12 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-[#111113] p-8 text-center">
          <div className="text-6xl mb-4">
            {finishReason === "time_up" ? "⏰" : winnerIsMe ? "🎉" : partnerWon ? "😢" : "🤝"}
          </div>
          <h2 className="text-2xl font-bold text-[#FFF5F8] mb-2">
            {finishReason === "time_up" ? "Waktu Habis!" : winnerIsMe ? "Kamu Menang!" : partnerWon ? "Pasanganmu Menang!" : "Game Selesai"}
          </h2>
          <p className="text-sm text-[#9B93B0] mb-2">
            {finishReason === "time_up"
              ? "Waktu 20 menit sudah habis."
              : winnerIsMe
              ? "Selamat! Kamu berhasil mencapai kotak 100 tepat!"
              : partnerWon
              ? "Pasanganmu mencapai kotak 100 duluan. Semangat!"
              : "Game selesai."}
          </p>

          {/* Posisi akhir */}
          <div className="my-5 flex justify-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-black text-[#FF3D7F]">{gs.host_position}</div>
              <div className="text-xs text-[#5C5470]">Host</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-[#818CF8]">{gs.partner_position}</div>
              <div className="text-xs text-[#5C5470]">Partner</div>
            </div>
          </div>

          <button onClick={handleNewGame}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#818CF8] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(129,140,248,0.35)] transition hover:bg-[#A78BFA]">
            Main Lagi
          </button>
        </div>
      </main>
    );
  }

  // PLAYING
  if (phase === "playing" && session && gameState) {
    const isMyTurn = gameState.current_turn === myRole;
    const hasPendingChallenge = !!gameState.pending_challenge;
    const lastRoll = gameState.last_roll;

    const dailyUrl = `https://ldrconnect.daily.co/${session.session_code}`;

    return (
      <main className="relative w-full max-w-6xl mx-auto px-4 py-6 lg:px-8">
        {/* Header bar */}
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-[#111113] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎲</span>
            <div>
              <p className="text-xs font-semibold text-[#FFF5F8]">Snake & Ladder</p>
              <p className="font-mono text-[10px] text-[#5C5470]">{session.session_code}</p>
            </div>
          </div>

          {/* Timer */}
          <div className={`font-mono text-lg font-black ${timerSeconds !== null && timerSeconds < 60 ? "text-red-400" : "text-[#FFF5F8]"}`}>
            {formatTime(timerSeconds)}
          </div>

          {/* Turn indicator */}
          <div className={`rounded-full px-3 py-1 text-xs font-bold ${isMyTurn ? "bg-[#818CF8]/20 text-[#818CF8]" : "bg-white/5 text-[#5C5470]"}`}>
            {hasPendingChallenge ? "⚡ Tantangan" : isMyTurn ? "Giliranmu" : "Giliran partner"}
          </div>

          {/* Video call toggle */}
          <button onClick={() => setShowVideo(!showVideo)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${showVideo ? "bg-[#FF3D7F]/20 text-[#FF6B9D]" : "bg-white/5 text-[#9B93B0] hover:bg-white/10"}`}>
            {showVideo ? "🎥 Tutup" : "🎥 Video"}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Board */}
          <div className="flex-1 flex justify-center">
            <SnakeBoard
              boardConfig={session.board_config}
              gameState={gameState}
              hostUserId={session.host_user_id}
              currentUserId={user?.id ?? ""}
            />
          </div>

          {/* Side panel: dadu + info */}
          <div className="lg:w-64 space-y-4">
            {/* Dice panel */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-5 flex flex-col items-center gap-4">
              <Dice
                value={diceValue}
                rolling={diceRolling}
                disabled={!isMyTurn || hasPendingChallenge || diceRolling}
                onRoll={handleRoll}
              />

              {/* Last roll info */}
              {lastRoll && (
                <div className="w-full rounded-xl bg-white/5 p-3 text-center space-y-1">
                  <p className="text-[10px] text-[#5C5470]">
                    {lastRoll.player === myRole ? "Kamu" : "Partner"} dapat angka{" "}
                    <span className="font-black text-[#FFF5F8] text-sm">{lastRoll.dice}</span>
                  </p>
                  {lastRoll.snake_from && (
                    <p className="text-[10px] text-red-400">🐍 Turun dari {lastRoll.snake_from} → {lastRoll.final}</p>
                  )}
                  {lastRoll.ladder_from && (
                    <p className="text-[10px] text-[#22C55E]">🪜 Naik dari {lastRoll.ladder_from} → {lastRoll.final}</p>
                  )}
                  {lastRoll.bounced && (
                    <p className="text-[10px] text-yellow-400">↩ Overshoot! Balik ke {lastRoll.final}</p>
                  )}
                  {lastRoll.dice === 6 && !lastRoll.bounced && (
                    <p className="text-[10px] text-yellow-400">★ Dapat 6 — lempar lagi!</p>
                  )}
                </div>
              )}

              {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
            </div>

            {/* Score board */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-4">
              <p className="mb-3 text-[10px] uppercase tracking-widest text-[#5C5470]">Posisi</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#FF3D7F]" />
                    <span className="text-xs text-[#9B93B0]">
                      {myRole === "host" ? "Kamu (Host)" : "Host"}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-black text-[#FFF5F8]">
                    {gameState.host_position === 0 ? "START" : gameState.host_position}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#818CF8]" />
                    <span className="text-xs text-[#9B93B0]">
                      {myRole === "partner" ? "Kamu (Partner)" : "Partner"}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-black text-[#FFF5F8]">
                    {gameState.partner_position === 0 ? "START" : gameState.partner_position}
                  </span>
                </div>
              </div>

              {/* Progress bars */}
              <div className="mt-3 space-y-1.5">
                <div className="h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-[#FF3D7F] transition-all duration-500"
                    style={{ width: `${gameState.host_position}%` }} />
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-[#818CF8] transition-all duration-500"
                    style={{ width: `${gameState.partner_position}%` }} />
                </div>
              </div>
            </div>

            {/* Turn status */}
            <div className={`rounded-2xl border p-4 text-center text-xs font-medium ${
              hasPendingChallenge
                ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
                : isMyTurn
                ? "border-[#818CF8]/20 bg-[#818CF8]/5 text-[#818CF8]"
                : "border-white/[0.07] bg-white/[0.02] text-[#5C5470]"
            }`}>
              {hasPendingChallenge
                ? "⚡ Ada tantangan yang harus diselesaikan!"
                : isMyTurn
                ? "🎲 Lempar dadu sekarang!"
                : "⏳ Menunggu giliran partner..."}
            </div>
          </div>
        </div>

        {/* Video call embed */}
        {showVideo && (
          <div className="fixed bottom-4 right-4 z-40 w-80 rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between bg-[#111113] px-3 py-2">
              <span className="text-xs font-semibold text-[#9B93B0]">Video Call</span>
              <button onClick={() => setShowVideo(false)} className="text-[#5C5470] hover:text-[#FFF5F8]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <iframe
              ref={dailyRef}
              src={dailyUrl}
              allow="camera; microphone; fullscreen; display-capture"
              className="w-full"
              style={{ height: 220, border: "none" }}
            />
          </div>
        )}

        {/* Challenge Modal */}
        {hasPendingChallenge && gameState.pending_challenge && myRole && (
          <ChallengeModal
            challenge={gameState.pending_challenge}
            myRole={myRole}
            isConfirming={isConfirming}
            onConfirm={handleConfirmChallenge}
          />
        )}
      </main>
    );
  }

  return null;
}

// ── Wrapper with Suspense ──────────────────────────────────────────────────────
export default function SnakeGamePage() {
  return (
    <Suspense fallback={
      <main className="relative mx-auto w-full max-w-md px-6 py-12 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-[#111113] p-6 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-12 w-12 mx-auto rounded-lg bg-white/10"></div>
            <div className="h-4 w-24 mx-auto rounded bg-white/10"></div>
            <div className="h-3 w-32 mx-auto rounded bg-white/10"></div>
          </div>
        </div>
      </main>
    }>
      <SnakeGameContent />
    </Suspense>
  );
}
