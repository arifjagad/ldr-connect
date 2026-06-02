"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { TodQuestion, TodSession } from "@/lib/types";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "@/components/ui/Toast";
import { sendBrowserNotification, requestNotificationPermission } from "@/lib/notifications";
import { GamePageLayout, GamePageSkeleton } from "@/components/games/GamePageLayout";
import { GamePlayingHeader } from "@/components/games/GamePlayingHeader";
import { GameFinishedCard } from "@/components/games/GameFinishedCard";
import { GameIdleLayout, GameRulesList } from "@/components/games/GameIdleLayout";
import { GameSurrenderModal, GameSurrenderButton } from "@/components/games/GameSurrenderModal";

type RealtimeSubscription = { unsubscribe: () => void };

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = "idle" | "waiting" | "playing" | "finished";
type FinishReason = "completed" | "time_up" | null;

type NextResponse = { next_question: TodQuestion | null; is_finished: boolean };
type DoneResponse = { completed_question: TodQuestion | null; next_question: TodQuestion | null; is_finished: boolean };
type JoinResponse = { session: TodSession };

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuestionTypeBadge({ type }: { type: "truth" | "dare" }) {
  if (type === "truth") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#818CF8]/30 bg-[#818CF8]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#A78BFA]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#818CF8] shadow-[0_0_6px_#818CF8]" />
        Truth
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF3D7F]/30 bg-[#FF3D7F]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#FF6B9D]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#FF3D7F] shadow-[0_0_6px_#FF3D7F]" />
      Dare
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<{ data: T; message: string }> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Terjadi kesalahan");
  return json;
}

function TodContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("romantis");
  const [joinCodeInput, setJoinCodeInput] = useState(
    searchParams?.get("join")?.toUpperCase() ?? ""
  );
  const [session, setSession] = useState<TodSession | null>(null);
  const [isHost, setIsHost] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<TodQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishReason, setFinishReason] = useState<FinishReason>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Pre-join lobby: menyimpan kode sesi yang belum di-join
  const [preJoinCode, setPreJoinCode] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState<number>(0);

  const realtimeRef = useRef<RealtimeSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);
  const phaseRef = useRef<GamePhase>("idle");

  // ── Helpers ──────────────────────────────────────────────────────────────

  function applySession(s: TodSession, isFinished = false) {
    // Jika sesi sudah cancelled, jangan resume — reset ke idle
    if (s.status === "cancelled") {
      phaseRef.current = "idle";
      setPhase("idle");
      setSession(null);
      setCurrentQuestion(null);
      return;
    }

    setSession(s);
    // Anggap expired jika status masih 'playing' tapi expires_at sudah lewat
    const isExpiredByTime =
      s.status === "playing" &&
      !!s.expires_at &&
      new Date(s.expires_at) < new Date();

    if (isFinished || s.status === "completed" || s.status === "expired" || isExpiredByTime) {
      setFinishReason(s.status === "expired" || isExpiredByTime ? "time_up" : "completed");
      phaseRef.current = "finished";
      setPhase("finished");
      setCurrentQuestion(null);
      return;
    }
    if (s.status === "playing") {
      // Notif browser jika transisi dari waiting ke playing (partner baru join)
      if (phaseRef.current === "waiting") {
        sendBrowserNotification("Partner sudah bergabung! 🔥", {
          body: "Truth or Dare siap dimulai!",
          tag: "partner-join",
        });
      }
      phaseRef.current = "playing";
      setPhase("playing");
      const active = s.questions.find((q) => !q.is_completed) ?? null;
      setCurrentQuestion(active);
    } else if (s.status === "waiting") {
      phaseRef.current = "waiting";
      setPhase("waiting");
    } else {
      // Status tidak dikenal — fallback ke idle
      phaseRef.current = "idle";
      setPhase("idle");
      setSession(null);
    }
  }

  const refreshSession = useCallback(async (code: string) => {
    if (loadingRef.current) return;
    try {
      const json = await apiFetch<{ session: TodSession }>(`/api/game/tod/session/${code}`);
      applySession(json.data.session);
    } catch { /* ignore transient errors */ }
  }, []);

  // ── Realtime via Supabase ─────────────────────────────────────────────────

  function startRealtime(code: string, userId?: string) {
    stopRealtime();

    const supabase = createClient();
    const channel = supabase
      .channel(`tod-session-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `session_code=eq.${code}` },
        (payload) => { applySession(payload.new as TodSession); }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const users = Object.values(state).flat();
        setPartnerOnline(users.some((p) => p.user_id !== userId));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeOk(true);
          if (userId) await channel.track({ user_id: userId });
          if (phaseRef.current !== "idle" && phaseRef.current !== "finished") {
            await refreshSession(code);
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeOk(false);
        }
      });

    realtimeRef.current = { unsubscribe: () => supabase.removeChannel(channel) };
  }

  function stopRealtime() {
    realtimeRef.current?.unsubscribe();
    realtimeRef.current = null;
    setPartnerOnline(false);
    setRealtimeOk(true);
  }

  function startSessionTimer(expiresAt: string, onExpire?: () => void) {
    if (timerRef.current) clearInterval(timerRef.current);
    const initialRemaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const shouldFireExpire = initialRemaining > 0;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (shouldFireExpire) onExpire?.();
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  // ── Session timer: mulai saat phase = playing, berdasarkan expires_at ─────

  useEffect(() => {
    if (phase === "playing" && session?.expires_at) {
      const code = session.session_code;
      startSessionTimer(session.expires_at, () => {
        stopRealtime();
        setFinishReason("time_up");
        phaseRef.current = "finished";
        setPhase("finished");
        setCurrentQuestion(null);
        // Tandai expired di DB (best effort — tidak await agar UI tidak tergantung)
        fetch(`/api/game/tod/session/${code}/expire`, { method: "POST" }).catch(() => {});
      });
    } else {
      stopTimer();
    }
    return () => stopTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.expires_at]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    async function init() {
      // Load kategori
      try {
        const json = await apiFetch<{ categories: string[] }>("/api/game/tod/categories");
        setCategories(json.data.categories);
        if (json.data.categories.length > 0) setCategory(json.data.categories[0]);
      } catch {
        setCategories(["romantis", "kenangan", "mimpi", "tantangan", "seru"]);
      }

      // Cek URL join code — tampilkan pre-join lobby
      const urlCode = (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("join")
        : null)?.toUpperCase() ?? "";

      if (urlCode) {
        window.history.replaceState({}, "", window.location.pathname);
        setJoinCodeInput(urlCode);
        setPreJoinCode(urlCode);
        setIsHost(false);
        phaseRef.current = "waiting";
        setPhase("waiting");
        return; // Jangan load active session, langsung ke lobby
      }

      // Cek apakah ada sesi aktif — jika ada, langsung resume
      try {
        const json = await apiFetch<{ session: TodSession | null; is_host: boolean }>("/api/game/tod/session/active");
        if (json.data.session) {
          const s = json.data.session;
          setIsHost(json.data.is_host);
          // Jika sesi masih waiting dan user bukan host → pre-join lobby
          if (s.status === "waiting" && user?.id && s.host_user_id !== user.id) {
            setJoinCodeInput(s.session_code);
            setPreJoinCode(s.session_code);
            phaseRef.current = "waiting";
            setPhase("waiting");
            return;
          }
          applySession(s);
          startRealtime(s.session_code, user?.id);
        }
      } catch { /* tidak ada sesi aktif, biarkan idle */ }
    }
    init();
    return () => { stopRealtime(); stopTimer(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError(null);
    try {
      const json = await apiFetch<{ session: TodSession }>("/api/game/tod/session/create", {
        method: "POST", body: JSON.stringify({ category }),
      });
      setIsHost(true);
      applySession(json.data.session);
      startRealtime(json.data.session.session_code, user?.id);
      toast.success("Sesi berhasil dibuat!", "Bagikan kode ke partner dan tunggu mereka bergabung.");
      requestNotificationPermission();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error("Gagal membuat sesi", msg);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  async function handleJoin() {
    const code = (preJoinCode ?? joinCodeInput).trim().toUpperCase();
    if (!code || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError(null);
    try {
      const json = await apiFetch<JoinResponse>("/api/game/tod/session/join", {
        method: "POST", body: JSON.stringify({ session_code: code }),
      });
      setPreJoinCode(null);
      setIsHost(false);
      applySession(json.data.session);
      startRealtime(json.data.session.session_code, user?.id);
      toast.success("Berhasil bergabung!", "Game dimulai!");
    } catch (e) {
      const msg = (e as Error).message;
      toast.error("Gagal bergabung", msg);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  async function handleNext() {
    if (!session || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError(null);
    try {
      const json = await apiFetch<NextResponse>(`/api/game/tod/session/${session.session_code}/next`, {
        method: "POST",
      });
      if (json.data.is_finished) {
        stopRealtime();
        stopTimer();
        setFinishReason("completed");
        phaseRef.current = "finished";
        setPhase("finished");
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(json.data.next_question);
      }
    } catch (e) {
      toast.error("Gagal", (e as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  async function handleDone() {
    if (!session || !currentQuestion || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError(null);
    try {
      const json = await apiFetch<DoneResponse>(`/api/game/tod/session/${session.session_code}/done`, {
        method: "POST",
        body: JSON.stringify({ question_order: currentQuestion.order }),
      });
      // Optimistic update: tandai pertanyaan selesai di local state supaya counter langsung update
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.order === currentQuestion.order ? { ...q, is_completed: true } : q
          ),
        };
      });
      if (json.data.is_finished) {
        stopRealtime();
        stopTimer();
        setFinishReason("completed");
        phaseRef.current = "finished";
        setPhase("finished");
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(json.data.next_question);
      }
    } catch (e) {
      toast.error("Gagal", (e as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  async function handleLeave() {
    // Batalkan / expire sesi di database sebelum reset local state
    if (session) {
      const code = session.session_code;
      if (session.status === "waiting") {
        fetch(`/api/game/tod/session/${code}/cancel`, { method: "POST" }).catch(() => {});
      } else if (session.status === "playing") {
        fetch(`/api/game/tod/session/${code}/expire`, { method: "POST" }).catch(() => {});
      }
    }
    stopRealtime();
    stopTimer();
    setPhase("idle");
    setSession(null);
    setCurrentQuestion(null);
    setError(null);
    setFinishReason(null);
    setShowVideo(false);
    setPreJoinCode(null);
    setShowSurrenderConfirm(false);
  }

  async function handleSurrender() {
    if (!session) return;
    try {
      await fetch(`/api/game/tod/session/${session.session_code}/expire`, { method: "POST" });
      stopRealtime();
      stopTimer();
      setFinishReason("time_up");
      phaseRef.current = "finished";
      setPhase("finished");
      setCurrentQuestion(null);
    } catch (e) {
      toast.error("Gagal menyerah", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setShowSurrenderConfirm(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalQ = (session?.questions ?? []).length;
  const completedQ = (session?.questions ?? []).filter((q) => q.is_completed).length;
  const progressPct = totalQ > 0 ? Math.round((completedQ / totalQ) * 100) : 0;
  const totalSeconds = session?.expires_at
    ? Math.max(0, Math.round((new Date(session.expires_at).getTime() - (session.partner_joined_at ? new Date(session.partner_joined_at).getTime() : Date.now())) / 1000))
    : 600;

  // ── Render ────────────────────────────────────────────────────────────────

  // Pre-join logic
  const isHostUser = !!(session && user && session.host_user_id === user.id);
  const isPartnerPreJoin = !!(preJoinCode && !session);
  const displayCode = session?.session_code ?? preJoinCode ?? "";

  return (
    <GamePageLayout
      gameName="Truth or Dare"
      gameEmoji="🔥"
      gameSlug="tod"
      gameSubtitle="Main bareng pasangan, jujur atau tantangan!"
      accentColor="#FF3D7F"
      accentColorLight="#FF6B9D"
      phase={phase}
      // Waiting
      sessionCode={displayCode}
      isHost={!isPartnerPreJoin && isHostUser}
      onCancel={handleLeave}
      onJoin={(!isHostUser || isPartnerPreJoin) ? handleJoin : undefined}
      joinLoading={loading}
      expiryMinutes={10}
      waitingError={error}
      // Playing
      realtimeOk={realtimeOk}
      showVideo={showVideo}
      videoSessionCode={session?.session_code}
      videoGame="tod"
      onVideoLeave={() => setShowVideo(false)}
      // Idle
      idleContent={
        <GameIdleLayout
          accentColor="#FF3D7F"
          accentColorLight="#FF6B9D"
          joinCodeInput={joinCodeInput}
          onJoinCodeChange={setJoinCodeInput}
          onJoin={handleJoin}
          joinLoading={loading}
          joinDisabled={loading || joinCodeInput.trim().length < 4}
          createContent={
            <>
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#FF6B9D]">Buat Sesi Baru</p>

              {/* Header icon+text */}
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF3D7F]/15">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3D7F" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[#FFF5F8]">Kamu jadi host</p>
                  <p className="text-xs text-[#5C5470]">Partner join pakai session code</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#9B93B0] mb-2">
                    Kategori Pertanyaan
                  </label>
                  <SearchableSelect
                    options={categories.map((c) => ({
                      value: c,
                      label: c.charAt(0).toUpperCase() + c.slice(1),
                    }))}
                    value={category}
                    onChange={setCategory}
                    placeholder="Pilih kategori..."
                    searchPlaceholder="Cari kategori..."
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(255,61,127,0.35)] transition hover:bg-[#FF6B9D] hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {loading ? "Membuat sesi…" : "✨ Mulai & Buat Sesi"}
                </button>
                <p className="text-center text-[10px] text-[#5C5470]">Memotong 1 coin per sesi</p>
              </div>
            </>
          }
          joinContent={
            <GameRulesList rules={[
              "Setiap giliran ambil satu kartu",
              "Pilih Truth atau jawab Dare-nya",
              "Partner bisa lihat & konfirmasi selesai",
              "Selesaikan semua kartu untuk menang!",
              "Durasi sesi: maksimal 10 menit",
            ]} />
          }
        />
      }
      // Playing
      playingContent={
        session ? (
          <div className="space-y-4">
            {/* Playing header */}
            <GamePlayingHeader
              sessionCode={session.session_code}
              statusText={`${completedQ}/${totalQ} pertanyaan`}
              statusColor="#9B93B0"
              timerSeconds={timeLeft}
              timerTotalSeconds={totalSeconds}
              partnerOnline={partnerOnline}
              showVideo={showVideo}
              onToggleVideo={() => setShowVideo((v) => !v)}
              onLeave={handleLeave}
              realtimeOk={realtimeOk}
            />

            {/* Progress bar pertanyaan */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-linear-to-r from-[#FF3D7F] to-[#818CF8] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Question card */}
            {currentQuestion ? (
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
                <div
                  className="h-1 w-full"
                  style={{
                    background:
                      currentQuestion.type === "truth"
                        ? "linear-gradient(90deg, #818CF8, #A78BFA)"
                        : "linear-gradient(90deg, #FF3D7F, #FF6B9D)",
                  }}
                />
                <div className="p-5 sm:p-8">
                  {/* Type + category */}
                  <div className="flex items-center gap-2">
                    <QuestionTypeBadge type={currentQuestion.type} />
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-[#5C5470] capitalize">
                      {currentQuestion.category}
                    </span>
                  </div>

                  {/* Question text */}
                  <p className="mt-6 text-xl font-semibold leading-relaxed text-[#FFF5F8]">
                    {currentQuestion.question ?? "Pertanyaan dimuat…"}
                  </p>

                  {/* Question number */}
                  <p className="mt-4 text-xs text-[#5C5470]">
                    Pertanyaan ke-{currentQuestion.order} dari {totalQ}
                  </p>

                  {/* Action buttons */}
                  <div className="mt-8 flex gap-3">
                    <button
                      type="button"
                      onClick={handleDone}
                      disabled={loading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.25)] transition hover:bg-[#FF6B9D] disabled:opacity-60"
                    >
                      {loading ? (
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {loading ? "Menyimpan…" : "Selesai & Lanjut"}
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={loading}
                      title="Lewati pertanyaan ini"
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-60"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Waiting for partner to load first question */
              <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#818CF8]/10">
                  <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="font-medium text-[#9B93B0]">Menunggu pertanyaan pertama…</p>
                <p className="mt-1 text-xs text-[#5C5470]">Host akan memulai sebentar lagi.</p>
              </div>
            )}

            {/* Surrender button */}
            <GameSurrenderButton onClick={() => setShowSurrenderConfirm(true)} />

            {/* Surrender confirm modal */}
            {showSurrenderConfirm && (
              <GameSurrenderModal
                hasWinner={false}
                warningText="Sesi akan ditandai selesai"
                onConfirm={handleSurrender}
                onCancel={() => setShowSurrenderConfirm(false)}
              />
            )}
          </div>
        ) : null
      }
      // Finished
      finishedContent={
        <GameFinishedCard
          gameName="Truth or Dare"
          gameEmoji="🔥"
          finishType={finishReason === "time_up" ? "time_up" : "complete"}
          title={finishReason === "time_up" ? "Waktu Habis!" : "Permainan Selesai!"}
          subtitle={
            finishReason === "time_up"
              ? `Waktu sesi telah habis. Kalian berhasil menjawab ${completedQ} dari ${totalQ} pertanyaan.`
              : `Kalian berhasil menjawab semua ${completedQ} pertanyaan. Seru kan?`
          }
          shareSummary={`${completedQ}/${totalQ} pertanyaan dijawab`}
          onPlayAgain={handleLeave}
          statsContent={
            <>
              {/* Progress bar */}
              <div>
                <div
                  className="flex justify-between text-xs mb-1.5"
                  style={{ color: finishReason === "time_up" ? "#FBBF24" : "#34D399" }}
                >
                  <span>Pertanyaan dijawab</span>
                  <span>{completedQ}/{totalQ}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: totalQ > 0 ? `${Math.round((completedQ / totalQ) * 100)}%` : "0%",
                      background: finishReason === "time_up"
                        ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
                        : "linear-gradient(90deg, #34D399, #6EE7B7)",
                    }}
                  />
                </div>
              </div>

              {/* Detail stats */}
              <div className="flex justify-between text-xs text-[#5C5470]">
                <span>Game</span>
                <span className="text-[#9B93B0]">Truth or Dare</span>
              </div>
              {session?.session_code && (
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Session</span>
                  <span className="font-mono text-[#9B93B0]">{session.session_code}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-[#5C5470]">
                <span>Hasil</span>
                <span
                  className="font-medium"
                  style={{ color: finishReason === "time_up" ? "#FBBF24" : "#34D399" }}
                >
                  {finishReason === "time_up" ? "Waktu Habis" : "Selesai"}
                </span>
              </div>
            </>
          }
        />
      }
    />
  );
}

// ── Wrapper with Suspense ──────────────────────────────────────────────────────
export default function TodPage() {
  return (
    <Suspense fallback={<GamePageSkeleton />}>
      <TodContent />
    </Suspense>
  );
}
