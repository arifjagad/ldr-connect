"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { QuoridorBoard } from "@/components/games/quoridor/QuoridorBoard";
import { WallModeToggle } from "@/components/games/quoridor/WallModeToggle";
import { VideoCall } from "@/components/VideoCall";
import { GameWaitingLobby } from "@/components/games/GameWaitingLobby";
import { RealtimeBanner } from "@/components/games/RealtimeBanner";
import { toast } from "@/components/ui/Toast";
import { Konfetti } from "@/components/ui/Konfetti";
import { ShareResult } from "@/components/ui/ShareResult";
import { sendBrowserNotification, requestNotificationPermission } from "@/lib/notifications";
import { useCountdown } from "@/lib/hooks/useCountdown";
import type { QuoridorSession, QuoridorGameState } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "idle" | "waiting" | "playing" | "finished";
type FinishReason = "time_up" | "completed" | "expired" | null;

function formatTime(s: number | null) {
  if (s === null) return "--:--";
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── Main Content ──────────────────────────────────────────────────────────────
function QuoridorContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [joinCodeInput, setJoinCodeInput] = useState(
    searchParams?.get("join")?.toUpperCase() ?? ""
  );

  const [phase, setPhase]               = useState<Phase>("idle");
  const [session, setSession]           = useState<QuoridorSession | null>(null);
  const [finishReason, setFinishReason] = useState<FinishReason>(null);
  const [gameState, setGameState]       = useState<QuoridorGameState | null>(null);

  // Pre-join lobby: menyimpan kode sesi yang belum di-join (untuk tampilkan lobby dulu)
  const [preJoinCode, setPreJoinCode]   = useState<string | null>(null);

  const [mode, setMode]           = useState<"move" | "wall">("move");
  const [wallOrient, setWallOrient] = useState<"H" | "V">("H");
  const [isActing, setIsActing]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin]     = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Video call
  const [showVideo, setShowVideo]       = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [realtimeOk, setRealtimeOk]     = useState(true);

  // Realtime refs
  const supabaseRef   = useRef(createClient());
  const channelRef    = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  // Ref untuk menyimpan snapshot gameState saat optimistic update (untuk rollback)
  const gameStateSnapshotRef = useRef<QuoridorGameState | null>(null);

  const myRole = session
    ? session.host_user_id === user?.id ? "host" : "partner"
    : null;

  // ── Timer ─────────────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (!session) return;
    setFinishReason("time_up");
    setPhase("finished");
    fetch(`/api/game/quoridor/session/${session.session_code}/expire`, { method: "POST" }).catch(() => {});
  }, [session]);

  const timerSeconds = useCountdown(
    phase === "playing" ? session?.expires_at ?? null : null,
    handleTimerExpire
  );

  // ── Apply session ─────────────────────────────────────────────────────────
  const applySession = useCallback((s: QuoridorSession | null) => {
    if (!s) {
      setSession(null);
      setPhase("idle");
      return;
    }

    const isExpiredByTime =
      s.status === "playing" && !!s.expires_at && new Date(s.expires_at) < new Date();

    if (
      s.status === "completed" ||
      s.status === "expired" ||
      s.status === "cancelled" ||
      isExpiredByTime
    ) {
      setSession(s);
      setGameState(s.game_state as QuoridorGameState);
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
    setGameState(s.game_state as QuoridorGameState);
    if (s.status === "waiting") setPhase("waiting");
    else if (s.status === "playing") {
      if (prevStatusRef.current === "waiting") {
        sendBrowserNotification("Partner sudah bergabung! ♟️", {
          body: "Game Quoridor siap dimulai!",
          tag:  "partner-join",
        });
      }
      setPhase("playing");
    }
    prevStatusRef.current = s.status;
  }, []);

  // ── Load active session on mount ──────────────────────────────────────────
  useEffect(() => {
    const urlCode = (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("join")
      : null
    )?.toUpperCase() ?? "";

    if (urlCode) {
      // Datang dari join link — tampilkan pre-join lobby dulu (seperti ToD)
      // Bersihkan URL agar tidak join ulang saat refresh
      window.history.replaceState({}, "", window.location.pathname);
      setJoinCodeInput(urlCode);
      setPreJoinCode(urlCode);
      setPhase("waiting");
      return;
    }

    // Tidak ada join code di URL — cek sesi aktif milik couple
    fetch("/api/game/quoridor/session/active")
      .then((r) => r.json())
      .then((res) => {
        const s = res.data?.session;
        if (!s) return;
        // Jika sesi masih waiting tapi user bukan host (user = partner yang belum join)
        // → tampilkan pre-join lobby agar partner bisa klik "Join Sekarang"
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

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.session_code) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setPartnerOnline(false);
      return;
    }

    const code      = session.session_code;
    const supabase  = supabaseRef.current;
    const channel   = supabase
      .channel(`quoridor:${code}`)
      // ── Broadcast: update instan dari server setelah setiap aksi (~50ms) ──
      .on("broadcast", { event: "game_state_update" }, ({ payload }) => {
        const gs = payload?.game_state as QuoridorGameState | undefined;
        if (!gs) return;
        setGameState(gs);
        // Jika ada pemenang, update session status ke completed
        if (gs.winner) {
          setSession((prev) => prev ? { ...prev, status: "completed", game_state: gs } : prev);
          setFinishReason("completed");
          setPhase("finished");
        }
      })
      // ── postgres_changes: fallback jika broadcast terlambat/gagal ─────────
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `session_code=eq.${code}` },
        (payload) => {
          const updated = payload.new as QuoridorSession;
          applySession(updated);
          setGameState(updated.game_state as QuoridorGameState);
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
          // Re-fetch state terbaru setelah subscribe
          try {
            const res  = await fetch(`/api/game/quoridor/session/${code}`);
            if (res.ok) {
              const data = await res.json();
              if (data.data?.session) applySession(data.data.session);
            }
          } catch { /* ignore — realtime akan sync */ }
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
  async function handleCreateSession() {
    setLoadingCreate(true);
    setError(null);
    try {
      const res  = await fetch("/api/game/quoridor/session/create", { method: "POST" });
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      if (!data.success) throw new Error(data.message);
      applySession(data.data.session);
      toast.success("Board siap!", "Bagikan kode sesi ke partner dan tunggu mereka bergabung.");
      requestNotificationPermission();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal membuat sesi";
      setError(msg);
      toast.error("Gagal membuat sesi", msg);
    } finally {
      setLoadingCreate(false);
      setShowConfirm(false);
    }
  }

  async function handleJoin() {
    const code = (preJoinCode ?? joinCodeInput).trim();
    if (!code) return;
    setLoadingJoin(true);
    setError(null);
    try {
      const res  = await fetch("/api/game/quoridor/session/join", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      if (!data.success) throw new Error(data.message);
      setPreJoinCode(null);
      applySession(data.data.session);
      toast.success("Berhasil bergabung!", "Game akan segera dimulai.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal bergabung";
      setError(msg);
      toast.error("Gagal bergabung", msg);
    } finally {
      setLoadingJoin(false);
    }
  }

  async function handleMove(r: number, c: number) {
    if (!session || isActing || !gameState || !myRole) return;
    setIsActing(true);
    setError(null);

    // Simpan snapshot untuk rollback
    gameStateSnapshotRef.current = gameState;

    // ── Optimistic update: perbarui posisi pion langsung di UI ──
    const optimistic: QuoridorGameState = {
      ...gameState,
      host_pos:    myRole === "host"    ? { r, c } : gameState.host_pos,
      partner_pos: myRole === "partner" ? { r, c } : gameState.partner_pos,
      current_turn: myRole === "host" ? "partner" : "host",
    };
    setGameState(optimistic);

    try {
      const res  = await fetch(`/api/game/quoridor/session/${session.session_code}/action`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "move", r, c }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        // Rollback optimistic
        setGameState(gameStateSnapshotRef.current ?? optimistic);
        throw new Error(data.message ?? "Gagal bergerak");
      }
      const data = await res.json();
      if (!data.success) {
        // Rollback optimistic jika gagal
        setGameState(gameStateSnapshotRef.current ?? optimistic);
        throw new Error(data.message);
      }
      // Server state adalah sumber kebenaran (termasuk win detection)
      setGameState(data.data.game_state);
      if (data.data.game_state.winner) {
        setFinishReason("completed");
        setPhase("finished");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal bergerak");
    } finally {
      setIsActing(false);
    }
  }

  async function handleWall(orientation: "H" | "V", r: number, c: number) {
    if (!session || isActing || !gameState || !myRole) return;
    setIsActing(true);
    setError(null);

    // Simpan snapshot untuk rollback
    gameStateSnapshotRef.current = gameState;

    // ── Optimistic update: tampilkan tembok baru langsung di UI ──
    const newWall = { orientation, r, c };
    const optimistic: QuoridorGameState = {
      ...gameState,
      walls:       [...gameState.walls, newWall],
      walls_left:  {
        ...gameState.walls_left,
        [myRole]: gameState.walls_left[myRole] - 1,
      },
      current_turn: myRole === "host" ? "partner" : "host",
    };
    setGameState(optimistic);

    try {
      const res  = await fetch(`/api/game/quoridor/session/${session.session_code}/action`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "wall", orientation, r, c }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        setGameState(gameStateSnapshotRef.current ?? optimistic);
        throw new Error(data.message ?? "Gagal memasang tembok");
      }
      const data = await res.json();
      if (!data.success) {
        // Rollback optimistic jika gagal
        setGameState(gameStateSnapshotRef.current ?? optimistic);
        throw new Error(data.message);
      }
      setGameState(data.data.game_state);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memasang tembok";
      setError(msg);
      toast.error("Tembok tidak bisa dipasang", msg);
    } finally {
      setIsActing(false);
    }
  }

  function handleNewGame() {
    if (session?.status === "waiting" && session.host_user_id === user?.id) {
      // Cancel sesi menunggu — sama seperti Snake Ladder & Dare Derby
      fetch(`/api/game/session/${session.session_code}/cancel`, { method: "POST" }).catch(() => {});
    }
    setSession(null);
    setGameState(null);
    setPhase("idle");
    setFinishReason(null);
    setPreJoinCode(null);
    setMode("move");
    setWallOrient("H");
    setShowVideo(false);
    setError(null);
    setShowConfirm(false);
    // Clear join param from URL
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  async function handleSurrender() {
    if (!session) return;
    try {
      const res  = await fetch(`/api/game/quoridor/session/${session.session_code}/surrender`, { method: "POST" });
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      if (!data.success) {
        setError(data.message ?? "Gagal menyerah");
        return;
      }
      // Broadcast sudah dikirim dari server — tunggu realtime atau terapkan langsung
      if (data.data?.game_state) {
        setGameState(data.data.game_state);
      }
      setFinishReason("completed");
      setPhase("finished");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyerah");
    } finally {
      setShowSurrenderConfirm(false);
    }
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, transparent 70%)" }}
        />

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
            <Link href="/dashboard/games" className="transition hover:text-[#9B93B0]">Games</Link>
            {" / "}Quoridor
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[#10B981]/30 to-[#34D399]/20 text-xl">
              ♟️
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#FFF5F8] sm:text-3xl">Quoridor</h1>
              <p className="text-sm text-[#5C5470]">Blokir jalur lawan, capai garis akhir duluan!</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Buat Game */}
          <div className="rounded-2xl border border-[#10B981]/20 bg-[#111113] p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#10B981]">
              Buat Game Baru
            </p>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10B981]/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[#FFF5F8]">Kamu jadi host</p>
                <p className="text-xs text-[#5C5470]">Partner join pakai session code</p>
              </div>
            </div>

            {/* Rules summary */}
            <div className="mb-6 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5C5470]">Cara Main</p>
              {[
                "Grid 9×9 — setiap giliran gerak ATAU pasang tembok",
                "Kamu punya 10 tembok untuk digunakan",
                "Host mulai dari baris paling atas, menuju baris bawah",
                "Partner mulai dari baris paling bawah, menuju baris atas",
                "Tembok tidak boleh memblokir total semua jalur lawan",
                "Yang pertama mencapai baris tujuan = MENANG! ♟️",
              ].map((rule, i) => (
                <p key={i} className="flex items-start gap-2 text-[10px] text-[#9B93B0]">
                  <span className="mt-0.5 text-[#5C5470]">•</span> {rule}
                </p>
              ))}
            </div>

            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

            <button
              onClick={() => setShowConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition hover:bg-[#34D399]"
            >
              Siapkan Papan →
            </button>
            <p className="mt-2 text-center text-[10px] text-[#5C5470]">Memotong 3 coin</p>
          </div>

          {/* Join Game */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#5C5470]">
              Gabung Game
            </p>

            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10B981]/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
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

            <input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="Masukkan kode sesi"
              maxLength={12}
              className="w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-3 font-mono text-base font-bold tracking-widest text-[#FFF5F8] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5C5470] focus:border-[#10B981]/40 focus:ring-1 focus:ring-[#10B981]/20"
            />
            <button
              onClick={handleJoin}
              disabled={loadingJoin || !joinCodeInput.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 px-5 py-3 text-sm font-bold text-[#10B981] transition hover:bg-[#10B981]/20 disabled:opacity-50"
            >
              {loadingJoin ? "Bergabung..." : "Bergabung"}
            </button>
          </div>
        </div>

        {/* Confirm Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !loadingCreate && setShowConfirm(false)}
            />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#10B981]/25 bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
              <div className="h-0.5 w-full bg-linear-to-r from-[#10B981] to-[#34D399]" />
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#10B981]">Konfirmasi</p>
                <h2 className="mt-1 text-xl font-bold text-[#FFF5F8]">Mulai game Quoridor?</h2>
                <div className="my-5 space-y-2.5 text-sm text-[#9B93B0]">
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    Papan 9×9 kosong disiapkan
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    Setiap pemain mendapat <span className="font-semibold text-[#FFF5F8]">10 tembok</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    <span><span className="font-semibold text-[#FF6B9D]">3 coin</span> akan dipotong</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    Durasi game: <span className="font-semibold text-[#FFF5F8]">30 menit</span>
                  </p>
                </div>
                {error && <p className="mb-4 text-xs text-red-400">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={loadingCreate}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCreateSession}
                    disabled={loadingCreate}
                    className="flex-1 rounded-xl bg-[#10B981] py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition hover:bg-[#34D399] disabled:opacity-50"
                  >
                    {loadingCreate ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                        </svg>
                        Membuat...
                      </span>
                    ) : "Mulai Game!"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ── WAITING ───────────────────────────────────────────────────────────────
  // Tampilkan waiting lobby untuk host (session ada) ATAU partner pre-join (preJoinCode ada)
  if (phase === "waiting" && (session || preJoinCode)) {
    const isPartnerPreJoin = !!preJoinCode && !session;
    const displayCode     = session?.session_code ?? preJoinCode ?? "";
    const isHostUser      = session ? session.host_user_id === user?.id : false;

    return (
      <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
            <a href="/dashboard/games" className="transition hover:text-[#9B93B0]">Games</a>
            {" / "}Quoridor
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[#10B981]/30 to-[#34D399]/20 text-xl">
              ♟️
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#FFF5F8] sm:text-3xl">Quoridor</h1>
              <p className="text-sm text-[#5C5470]">Blokir, strategi, menangkan!</p>
            </div>
          </div>
        </div>
        <GameWaitingLobby
          sessionCode={displayCode}
          gameName="Quoridor"
          gameEmoji="♟️"
          isHost={!isPartnerPreJoin && isHostUser}
          onCancel={handleNewGame}
          onJoin={(!isHostUser || isPartnerPreJoin) ? handleJoin : undefined}
          joinLoading={loadingJoin}
          expiryMinutes={10}
        />
        {error && (
          <p className="mt-3 text-center text-sm text-red-400">{error}</p>
        )}
      </main>
    );
  }

  // ── FINISHED ──────────────────────────────────────────────────────────────
  if (phase === "finished" && session && gameState) {
    const winnerIsMe   = gameState.winner === myRole;
    const partnerWon   = !!(gameState.winner && gameState.winner !== myRole);
    const accentColor  = finishReason === "time_up"
      ? "rgba(251,191,36,0.25)"
      : winnerIsMe
      ? "rgba(16,185,129,0.20)"
      : "rgba(129,140,248,0.20)";
    const barBg = finishReason === "time_up"
      ? "linear-gradient(90deg,#FBBF24,#F59E0B)"
      : winnerIsMe
      ? "linear-gradient(90deg,#10B981,#34D399)"
      : "linear-gradient(90deg,#818CF8,#A78BFA)";

    return (
      <>
        <Konfetti active={winnerIsMe && finishReason !== "time_up"} />
        <main className="relative mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
          <div className="overflow-hidden rounded-2xl border bg-[#111113]" style={{ borderColor: accentColor }}>
            <div className="h-1 w-full" style={{ background: barBg }} />
            <div className="p-6 text-center sm:p-8">
              <div className="mb-4 text-5xl">
                {finishReason === "time_up" ? "⏰" : winnerIsMe ? "🎉" : partnerWon ? "😢" : "🤝"}
              </div>
              <h2 className="text-2xl font-bold text-[#FFF5F8]">
                {finishReason === "time_up"
                  ? "Waktu Habis!"
                  : winnerIsMe
                  ? "Kamu Menang!"
                  : partnerWon
                  ? "Pasanganmu Menang!"
                  : "Game Selesai"}
              </h2>
              <p className="mt-2 text-sm text-[#9B93B0]">
                {finishReason === "time_up"
                  ? "Waktu 30 menit sudah habis."
                  : winnerIsMe
                  ? "Selamat! Kamu berhasil mencapai garis tujuan duluan!"
                  : partnerWon
                  ? "Pasanganmu lebih cepat mencapai garis tujuan. Semangat!"
                  : "Game selesai."}
              </p>

              {/* Stats */}
              <div
                className="mx-auto mt-6 max-w-xs rounded-2xl border p-4 text-left space-y-3"
                style={{ borderColor: accentColor, background: winnerIsMe ? "rgba(16,185,129,0.06)" : finishReason === "time_up" ? "rgba(251,191,36,0.06)" : "rgba(129,140,248,0.06)" }}
              >
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Session</span>
                  <span className="font-mono text-[#9B93B0]">{session.session_code}</span>
                </div>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Pemenang</span>
                  <span className="font-medium" style={{ color: finishReason === "time_up" ? "#FBBF24" : winnerIsMe ? "#10B981" : "#818CF8" }}>
                    {finishReason === "time_up" ? "Waktu Habis" : winnerIsMe ? "Kamu 🏆" : partnerWon ? "Partner 🏆" : "Seri"}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Sisa tembok (Host)</span>
                  <span className="font-mono text-[#FF3D7F]">{gameState.walls_left.host}</span>
                </div>
                <div className="flex justify-between text-xs text-[#5C5470]">
                  <span>Sisa tembok (Partner)</span>
                  <span className="font-mono text-[#818CF8]">{gameState.walls_left.partner}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <ShareResult
                  gameName="Quoridor"
                  gameEmoji="♟️"
                  result={finishReason === "time_up" ? "complete" : winnerIsMe ? "win" : partnerWon ? "lose" : "draw"}
                  summary={`${gameState.walls.length} tembok dipasang total`}
                />
                <button
                  onClick={handleNewGame}
                  className="rounded-xl bg-[#10B981] py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition hover:bg-[#34D399]"
                >
                  Main Lagi
                </button>
                <Link
                  href="/dashboard/games"
                  className="rounded-xl border border-white/10 py-3 text-sm text-[#9B93B0] transition hover:bg-white/5 text-center"
                >
                  Pilih Game Lain
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  if (phase === "playing" && session && gameState && myRole) {
    const isMyTurn     = gameState.current_turn === myRole;
    const timerWarning = timerSeconds !== null && timerSeconds < 120;

    return (
      <>
        {/* Video Call overlay */}
        {showVideo && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
            <div className="absolute right-4 top-4 z-10">
              <button
                onClick={() => setShowVideo(false)}
                className="rounded-xl border border-white/10 bg-[#111113] px-4 py-2 text-sm text-[#9B93B0] transition hover:bg-white/10"
              >
                Tutup Video
              </button>
            </div>
            <VideoCall
              sessionCode={session.session_code}
              game="quoridor"
              onLeave={() => setShowVideo(false)}
            />
          </div>
        )}

        <main className="relative mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/games" className="text-xs text-[#5C5470] transition hover:text-[#9B93B0]">
                ← Games
              </Link>
              <span className="text-[#3a3650]">/</span>
              <span className="text-xs font-medium text-[#FFF5F8]">Quoridor</span>
            </div>
            <div className="flex items-center gap-2">
              <RealtimeBanner realtimeOk={realtimeOk} />
              <button
                onClick={() => setShowVideo((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-[#10B981]/25 bg-[#10B981]/8 px-3 py-1.5 text-xs font-medium text-[#10B981] transition hover:bg-[#10B981]/15"
              >
                📹 Video
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            {/* Board */}
            <div className="flex flex-col items-center gap-4">
              {/* Turn & Timer */}
              <div className="flex w-full max-w-[540px] items-center justify-between rounded-xl border border-white/[0.07] bg-[#111113] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: isMyTurn ? "#10B981" : "#5C5470", boxShadow: isMyTurn ? "0 0 8px #10B981" : "none" }}
                  />
                  <span className="text-sm font-semibold text-[#FFF5F8]">
                    {isMyTurn ? "Giliran kamu" : "Menunggu partner..."}
                  </span>
                </div>
                <div
                  className={`font-mono text-sm font-bold ${timerWarning ? "text-red-400" : "text-[#9B93B0]"}`}
                >
                  ⏱ {formatTime(timerSeconds)}
                </div>
              </div>

              <QuoridorBoard
                gameState={gameState}
                myRole={myRole}
                isMyTurn={isMyTurn}
                mode={mode}
                wallOrient={wallOrient}
                onMove={handleMove}
                onWall={handleWall}
                disabled={isActing}
              />

              {/* Error */}
              {error && (
                <div className="w-full max-w-[540px] rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* Right Panel */}
            <div className="space-y-4">
              {/* Status pemain */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#5C5470]">
                  Status Pemain
                </p>
                {/* Host */}
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] px-3 py-2.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-base"
                    style={{ background: "linear-gradient(135deg, #FF3D7F, #FF6B9D)", boxShadow: "0 0 10px rgba(255,61,127,0.4)" }}
                  >
                    ♟
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#FFF5F8]">
                      Host {myRole === "host" && <span className="text-[10px] text-[#10B981]">(Kamu)</span>}
                    </p>
                    <p className="text-[10px] text-[#5C5470]">
                      Baris {gameState.host_pos.r + 1} · Kolom {gameState.host_pos.c + 1}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#FF3D7F]">{gameState.walls_left.host}🧱</span>
                </div>
                {/* Partner */}
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/[0.07] px-3 py-2.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-base"
                    style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)", boxShadow: "0 0 10px rgba(129,140,248,0.4)" }}
                  >
                    ♟
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#FFF5F8]">
                      Partner {myRole === "partner" && <span className="text-[10px] text-[#10B981]">(Kamu)</span>}
                    </p>
                    <p className="text-[10px] text-[#5C5470]">
                      Baris {gameState.partner_pos.r + 1} · Kolom {gameState.partner_pos.c + 1}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#818CF8]">{gameState.walls_left.partner}🧱</span>
                </div>
                <p className="mt-2 text-[10px] text-[#5C5470]">
                  {partnerOnline ? "🟢 Partner online" : "⚫ Partner offline"}
                </p>
              </div>

              {/* Mode toggle */}
              {isMyTurn && (
                <WallModeToggle
                  mode={mode}
                  wallOrient={wallOrient}
                  wallsLeft={gameState.walls_left}
                  myRole={myRole}
                  isMyTurn={isMyTurn}
                  onModeChange={setMode}
                  onOrientChange={setWallOrient}
                />
              )}

              {/* Session code */}
              <div className="rounded-xl border border-white/[0.07] bg-[#111113] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5C5470]">Session Code</p>
                <p className="mt-1 font-mono text-sm font-bold tracking-widest text-[#FFF5F8]">{session.session_code}</p>
              </div>

              {/* Abandon — dengan konfirmasi */}
              <button
                onClick={() => setShowSurrenderConfirm(true)}
                className="w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10"
              >
                🏳️ Menyerah
              </button>
            </div>
          </div>
        </main>

        {/* Surrender Confirmation Modal */}
        {showSurrenderConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowSurrenderConfirm(false)}
            />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-red-500/25 bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
              <div className="h-0.5 w-full bg-linear-to-r from-red-500 to-red-400" />
              <div className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15">
                  <span className="text-2xl">🏳️</span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Konfirmasi</p>
                <h2 className="mt-1 text-xl font-bold text-[#FFF5F8]">Yakin ingin menyerah?</h2>
                <div className="my-5 space-y-2.5 text-sm text-[#9B93B0]">
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    Sesi game akan berakhir
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    <span><span className="font-semibold text-[#FF6B9D]">Partner dinyatakan menang</span></span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#5C5470]">•</span>
                    Koin tidak dikembalikan
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSurrenderConfirm(false)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-[#9B93B0] transition hover:bg-white/10"
                  >
                    Lanjut Bermain
                  </button>
                  <button
                    onClick={handleSurrender}
                    className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(239,68,68,0.35)] transition hover:bg-red-400"
                  >
                    Ya, Menyerah
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }


  return null;
}

// ── Page Export ───────────────────────────────────────────────────────────────
export default function QuoridorPage() {
  return (
    <Suspense>
      <QuoridorContent />
    </Suspense>
  );
}
