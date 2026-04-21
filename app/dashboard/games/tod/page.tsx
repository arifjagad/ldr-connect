"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TodQuestion, TodSession } from "@/lib/types";
import { SearchableSelect } from "@/components/SearchableSelect";
import { VideoCall } from "@/components/VideoCall";

type RealtimeSubscription = { unsubscribe: () => void };

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = "idle" | "waiting" | "playing" | "finished";
type FinishReason = "completed" | "time_up" | null;

type NextResponse = { next_question: TodQuestion | null; is_finished: boolean };
type DoneResponse = { completed_question: TodQuestion | null; next_question: TodQuestion | null; is_finished: boolean };
type JoinResponse = { session: TodSession };

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#9B93B0] transition hover:border-[#FF3D7F]/40 hover:bg-[#FF3D7F]/10 hover:text-[#FF6B9D]"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

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

  const [timeLeft, setTimeLeft] = useState<number>(0);

  const realtimeRef = useRef<RealtimeSubscription | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);
  const pollInFlightRef = useRef(false);
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
    if (loadingRef.current || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const json = await apiFetch<{ session: TodSession }>(`/api/game/tod/session/${code}`);
      applySession(json.data.session);
    } catch { /* ignore transient errors */ }
    finally { pollInFlightRef.current = false; }
  }, []);

  // ── Realtime via Supabase ─────────────────────────────────────────────────

  function startRealtime(code: string) {
    stopRealtime();

    // Supabase Realtime — subscribe ke perubahan game_sessions
    const supabase = createClient();
    const channel = supabase
      .channel(`tod-session-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `session_code=eq.${code}` },
        (payload) => {
          applySession(payload.new as TodSession);
        }
      )
      .subscribe();

    realtimeRef.current = { unsubscribe: () => supabase.removeChannel(channel) };

    // Polling sebagai fallback
    const schedulePoll = () => {
      if (phaseRef.current === "finished" || phaseRef.current === "idle") return;
      const delay = phaseRef.current === "waiting" ? 3000 : 2000;
      pollRef.current = setTimeout(async () => {
        await refreshSession(code);
        schedulePoll();
      }, delay);
    };
    schedulePoll();
  }

  function stopRealtime() {
    realtimeRef.current?.unsubscribe();
    realtimeRef.current = null;
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    pollInFlightRef.current = false;
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

      // Cek apakah ada sesi aktif — jika ada, langsung resume
      try {
        const json = await apiFetch<{ session: TodSession | null; is_host: boolean }>("/api/game/tod/session/active");
        if (json.data.session) {
          setIsHost(json.data.is_host);
          applySession(json.data.session);
          startRealtime(json.data.session.session_code);
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
      startRealtime(json.data.session.session_code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinCodeInput.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError(null);
    const code = joinCodeInput.trim().toUpperCase();
    try {
      const json = await apiFetch<JoinResponse>("/api/game/tod/session/join", {
        method: "POST", body: JSON.stringify({ session_code: code }),
      });
      setIsHost(false);
      applySession(json.data.session);
      startRealtime(json.data.session.session_code);
    } catch (e) {
      setError((e as Error).message);
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
      setError((e as Error).message);
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
      setError((e as Error).message);
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
        // Host membatalkan sesi yang belum dimulai → cancel + refund coin
        fetch(`/api/game/tod/session/${code}/cancel`, { method: "POST" }).catch(() => {});
      } else if (session.status === "playing") {
        // User keluar dari sesi yang sedang berjalan → tandai expired
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
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalQ = (session?.questions ?? []).length;
  const completedQ = (session?.questions ?? []).filter((q) => q.is_completed).length;
  const progressPct = totalQ > 0 ? Math.round((completedQ / totalQ) * 100) : 0;
  const totalSeconds = session?.expires_at
    ? Math.max(0, Math.round((new Date(session.expires_at).getTime() - (session.partner_joined_at ? new Date(session.partner_joined_at).getTime() : Date.now())) / 1000))
    : 600;
  const timerPct = totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 0;
  const timerColor = timerPct > 50 ? "#34D399" : timerPct > 20 ? "#FBBF24" : "#FF3D7F";
  const timerMM = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const timerSS = String(timeLeft % 60).padStart(2, "0");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="relative mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(255,61,127,0.10) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
          <Link href="/dashboard/games" className="transition hover:text-[#9B93B0]">Games</Link>
          {" / "}Truth or Dare
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[#FF3D7F]/30 to-[#818CF8]/20 text-xl">
            🔥
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FFF5F8]">Truth or Dare</h1>
            <p className="text-sm text-[#5C5470]">Main bareng pasangan, jujur atau tantangan!</p>
          </div>
        </div>
      </div>

      {/* ─── IDLE: Create / Join ─────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div className="space-y-4">
          {/* Create card */}
          <div className="rounded-2xl border border-[#FF3D7F]/20 bg-[#111113]">
            <div className="h-0.5 w-full rounded-t-2xl bg-linear-to-r from-[#FF3D7F] to-[#818CF8]" />
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF3D7F]/15">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3D7F" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[#FFF5F8]">Buat Sesi Baru</p>
                  <p className="text-xs text-[#5C5470]">Kamu jadi host, partner join pakai code</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#9B93B0]">
                    Kategori Pertanyaan
                  </label>
                  <div className="mt-2">
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
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.3)] transition hover:bg-[#FF6B9D] disabled:cursor-not-allowed disabled:opacity-60"
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
                  {loading ? "Membuat sesi…" : "Mulai & Buat Sesi"}
                </button>
              </div>
            </div>
          </div>

          {/* Join card */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#818CF8]/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[#FFF5F8]">Join Sesi Partner</p>
                <p className="text-xs text-[#5C5470]">Masukkan session code dari partner</p>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <input
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Masukkan session code"
                maxLength={12}
                className="flex-1 rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 font-mono text-sm tracking-widest text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#818CF8]/50 focus:ring-1 focus:ring-[#818CF8]/30 transition"
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={loading || joinCodeInput.trim().length < 4}
                className="flex items-center gap-2 rounded-xl bg-[#818CF8] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(129,140,248,0.3)] transition hover:bg-[#A78BFA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : "Join"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ─── WAITING: Lobi ──────────────────────────────────────────────────────── */}
      {phase === "waiting" && session && (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#111113] p-6 sm:p-8 text-center text-[#FFF5F8]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5C5470]/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9B93B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            {isHost ? (
              <>
                <h2 className="text-xl font-bold text-[#FFF5F8]">Menunggu Partner…</h2>
                <p className="mt-1 text-sm text-[#5C5470]">Bagikan session code ke pasanganmu</p>

                <div className="mt-6 flex w-full max-w-sm flex-col items-center rounded-xl border border-white/5 bg-[#18181C] p-6">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Session Code</span>
                  <span className="mt-2 font-mono text-2xl font-bold tracking-widest text-[#818CF8]">
                    {session.session_code}
                  </span>
                  <div className="mt-4 flex gap-2">
                    <CopyButton text={session.session_code} label="Salin Code" />
                  </div>
                </div>

                <div className="mt-6 w-full max-w-sm">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Ayo main Truth or Dare bareng aku di LDR-Connect! 🎮\n\nKlik link ini untuk langsung join:\n${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/join/${session.session_code}\n\nAtau masukkan kode: ${session.session_code}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366]/10 px-5 py-2.5 text-sm font-semibold text-[#25D366] ring-1 ring-[#25D366]/30 transition hover:bg-[#25D366]/20"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    Kirim via WhatsApp
                  </a>
                </div>

                <p className="mt-4 text-xs text-[#5C5470]">Sesi akan otomatis expired dalam 10 menit jika partner tidak bergabung.</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-[#FFF5F8]">Pasanganmu Memanggil!</h2>
                <p className="mt-1 text-sm text-[#5C5470]">Pasanganmu sedang menunggumu untuk bermain.</p>

                <div className="mt-6 flex w-full max-w-sm flex-col items-center rounded-xl border border-white/5 bg-[#18181C] p-6">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Sesi Aktif</span>
                  <span className="mt-2 font-mono text-2xl font-bold tracking-widest text-[#FF3D7F]">
                    {session.session_code}
                  </span>
                </div>

                <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setJoinCodeInput(session.session_code);
                      handleJoin();
                    }}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.3)] transition hover:bg-[#FF6B9D] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    Join Sesi Sekarang
                  </button>
                </div>
              </>
            )}

            {error && (
              <div className="mt-6 flex w-full max-w-sm items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
              <button
                type="button"
                onClick={handleLeave}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
              >
                Batalkan Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PLAYING: Game ───────────────────────────────────────────────────── */}
      {phase === "playing" && session && (
        <div className="space-y-4">
          {/* Game header */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-widest text-[#5C5470]">{session.session_code}</span>
                <span className="h-1 w-1 rounded-full bg-[#5C5470]" />
                <span className="text-xs text-[#9B93B0]">{completedQ}/{totalQ} pertanyaan</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Session timer */}
                <span
                  className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: timerColor }}
                >
                  {timerMM}:{timerSS}
                </span>
                {/* Video call toggle */}
                <button
                  type="button"
                  onClick={() => setShowVideo((v) => !v)}
                  title={showVideo ? "Tutup video call" : "Buka video call"}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                    showVideo
                      ? "border-[#34D399]/40 bg-[#34D399]/15 text-[#34D399]"
                      : "border-white/10 bg-white/5 text-[#5C5470] hover:text-[#9B93B0]"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleLeave}
                  className="text-xs text-[#5C5470] transition hover:text-[#9B93B0]"
                >
                  Keluar
                </button>
              </div>
            </div>
            {/* Timer bar */}
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
              />
            </div>
          </div>

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

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ─── FINISHED ────────────────────────────────────────────────────────── */}
      {phase === "finished" && (
        <div className="overflow-hidden rounded-2xl border bg-[#111113]"
          style={{ borderColor: finishReason === "time_up" ? "rgba(251,191,36,0.25)" : "rgba(52,211,153,0.20)" }}
        >
          <div
            className="h-1 w-full"
            style={{
              background: finishReason === "time_up"
                ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
                : "linear-gradient(90deg, #34D399, #6EE7B7)",
            }}
          />
          <div className="p-6 sm:p-10 text-center">
            {finishReason === "time_up" ? (
              <>
                <div className="mb-4 text-5xl">⏰</div>
                <h2 className="text-2xl font-bold text-[#FFF5F8]">Waktu Habis!</h2>
                <p className="mt-2 text-sm text-[#9B93B0]">
                  Waktu sesi telah habis. Kalian berhasil menjawab{" "}
                  <span className="font-semibold text-[#FBBF24]">{completedQ} dari {totalQ} pertanyaan</span>.
                </p>
              </>
            ) : (
              <>
                <div className="mb-4 text-5xl">🎉</div>
                <h2 className="text-2xl font-bold text-[#FFF5F8]">Permainan Selesai!</h2>
                <p className="mt-2 text-sm text-[#9B93B0]">
                  Kalian berhasil menjawab semua{" "}
                  <span className="font-semibold text-[#34D399]">{completedQ} pertanyaan</span>. Seru kan?
                </p>
              </>
            )}

            {/* Stats card */}
            <div
              className="mx-auto mt-6 max-w-xs rounded-2xl border p-4 text-left space-y-3"
              style={{
                borderColor: finishReason === "time_up" ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.15)",
                background: finishReason === "time_up" ? "rgba(251,191,36,0.07)" : "rgba(52,211,153,0.07)",
              }}
            >
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1.5"
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
              {/* Tidak ada menang/kalah di ToD */}
              <div className="flex justify-between text-xs text-[#5C5470]">
                <span>Hasil</span>
                <span
                  className="font-medium"
                  style={{ color: finishReason === "time_up" ? "#FBBF24" : "#34D399" }}
                >
                  {finishReason === "time_up" ? "Waktu Habis" : "Selesai"}
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleLeave}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.25)] transition hover:bg-[#FF6B9D]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Main Lagi
              </button>
              <Link
                href="/dashboard/games/history"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Lihat History
              </Link>
              <Link
                href="/dashboard/games"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
              >
                Kembali ke Games
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── VIDEO CALL (floating panel, saat game berlangsung) ───────────────── */}
      {phase === "playing" && showVideo && session?.session_code && (
        <VideoCall
          sessionCode={session.session_code}
          onLeave={() => setShowVideo(false)}
        />
      )}
    </main>
  );
}

// ── Wrapper with Suspense ──────────────────────────────────────────────────────
export default function TodPage() {
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
      <TodContent />
    </Suspense>
  );
}
