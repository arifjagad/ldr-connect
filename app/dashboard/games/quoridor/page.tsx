"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { QuoridorBoard } from "@/components/games/quoridor/QuoridorBoard";
import { WallModeToggle } from "@/components/games/quoridor/WallModeToggle";
import { toast } from "@/components/ui/Toast";
import { sendBrowserNotification, requestNotificationPermission } from "@/lib/notifications";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { GamePageLayout, GamePageSkeleton } from "@/components/games/GamePageLayout";
import { GamePlayingHeader } from "@/components/games/GamePlayingHeader";
import { GameFinishedCard } from "@/components/games/GameFinishedCard";
import { GameIdleLayout, GameRulesList } from "@/components/games/GameIdleLayout";
import { usePartnerProfile } from "@/lib/hooks/usePartnerProfile";
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

  // Profil untuk share image — di-fetch saat game selesai
  const { profiles: shareProfiles } = usePartnerProfile(phase === "finished");

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
      toast.error("Gerakan gagal", e instanceof Error ? e.message : "Gagal bergerak");
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
      toast.error("Tembok tidak bisa dipasang", msg);
    } finally {
      setIsActing(false);
    }
  }

  function handleNewGame() {
    if (session?.status === "waiting" && session.host_user_id === user?.id) {
      // Cancel sesi menunggu
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
        toast.error("Gagal menyerah", data.message ?? "Terjadi kesalahan");
        return;
      }
      if (data.data?.game_state) {
        setGameState(data.data.game_state);
      }
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
  const totalSec = 30 * 60;
  const winnerIsMe = gameState?.winner === myRole;
  const partnerWon = !!(gameState?.winner && gameState.winner !== myRole);

  // Pre-join logic (when partner comes via join link)
  const isHostUser = !!(session && user && session.host_user_id === user.id);
  const isPartnerPreJoin = !!(preJoinCode && !session);
  const displayCode = session?.session_code ?? preJoinCode ?? "";

  return (
    <GamePageLayout
      gameName="Quoridor"
      gameEmoji="♟️"
      gameSlug="quoridor"
      gameSubtitle="Blokir jalur lawan, capai garis akhir duluan!"
      accentColor="#10B981"
      accentColorLight="#34D399"
      phase={phase}
      // Waiting
      sessionCode={displayCode}
      isHost={!isPartnerPreJoin && isHostUser}
      onCancel={handleNewGame}
      onJoin={(!isHostUser || isPartnerPreJoin) ? handleJoin : undefined}
      joinLoading={loadingJoin}
      expiryMinutes={10}
      // Playing
      realtimeOk={realtimeOk}
      showVideo={showVideo}
      videoSessionCode={session?.session_code}
      videoGame="quoridor"
      onVideoLeave={() => setShowVideo(false)}
      // Idle
      idleContent={
        <>
          <GameIdleLayout
            accentColor="#10B981"
            accentColorLight="#34D399"
            joinCodeInput={joinCodeInput}
            onJoinCodeChange={setJoinCodeInput}
            onJoin={handleJoin}
            joinLoading={loadingJoin}
            joinDisabled={loadingJoin || !joinCodeInput.trim()}
            createContent={
              <>
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

                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition hover:bg-[#34D399]"
                >
                  Siapkan Papan →
                </button>
                <p className="mt-2 text-center text-[10px] text-[#5C5470]">Memotong 3 coin</p>
              </>
            }
            joinContent={
              <GameRulesList rules={[
                "Grid 9×9 — gerak 1 kotak atau pasang tembok",
                "Host → baris bawah, Partner → baris atas",
                "Tembok menghalangi tapi tidak boleh block total",
                "Pertama sampai garis tujuan = MENANG!",
              ]} />
            }
          />

          {/* ── Confirm Modal ──────────────────────────────────────────────── */}
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
                      className="flex-1 rounded-xl bg-[#10B981] py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition hover:bg-[#34D399] disabled:opacity-50"
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
        session && gameState && myRole ? (
          <>
            <GamePlayingHeader
              sessionCode={session.session_code}
              statusText={isMyTurn ? "Giliran kamu" : "Menunggu partner..."}
              statusColor={isMyTurn ? "#10B981" : "#9B93B0"}
              timerSeconds={timerSeconds}
              timerTotalSeconds={totalSec}
              partnerOnline={partnerOnline}
              showVideo={showVideo}
              onToggleVideo={() => setShowVideo((v) => !v)}
              onLeave={handleNewGame}
              realtimeOk={realtimeOk}
            />

            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              {/* Board */}
              <div className="flex flex-col items-center gap-4">
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
        ) : null
      }
      // Finished
      finishedContent={
        session && gameState ? (
          <GameFinishedCard
            gameName="Quoridor"
            gameEmoji="♟️"
            finishType={finishReason === "time_up" ? "time_up" : winnerIsMe ? "win" : partnerWon ? "lose" : "complete"}
            title={
              finishReason === "time_up" ? "Waktu Habis!"
              : winnerIsMe ? "Kamu Menang!"
              : partnerWon ? "Pasanganmu Menang!"
              : "Game Selesai"
            }
            subtitle={
              finishReason === "time_up"
                ? "Waktu 30 menit sudah habis."
                : winnerIsMe
                ? "Selamat! Kamu berhasil mencapai garis tujuan duluan!"
                : partnerWon
                ? "Pasanganmu lebih cepat mencapai garis tujuan. Semangat!"
                : "Game selesai."
            }
            shareSummary={`${gameState.walls.length} tembok dipasang total`}
            onPlayAgain={handleNewGame}
            showKonfetti={winnerIsMe && finishReason !== "time_up"}
            myName={shareProfiles?.my.name}
            myAvatarUrl={shareProfiles?.my.avatar_url}
            partnerName={shareProfiles?.partner?.name}
            partnerAvatarUrl={shareProfiles?.partner?.avatar_url}
            playedAt={session.created_at}
            shareStats={[
              {
                label: "Hasil",
                value: finishReason === "time_up" ? "⏰ Waktu Habis" : winnerIsMe ? "🏆 Kamu Menang" : partnerWon ? "😅 Kamu Kalah" : "🤝 Seri",
              },
              { label: "Total tembok dipasang", value: `${gameState.walls.length} tembok` },
              { label: `Sisa tembok ${myRole === "host" ? "Kamu" : "Partner"} (host)`, value: `${gameState.walls_left.host} / 10` },
              { label: `Sisa tembok ${myRole === "partner" ? "Kamu" : "Partner"} (partner)`, value: `${gameState.walls_left.partner} / 10` },
              { label: "Session", value: session.session_code },
            ]}
            statsContent={
              <>
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
              </>
            }
          />
        ) : null
      }
    />
  );
}

// ── Page Export ───────────────────────────────────────────────────────────────
export default function QuoridorPage() {
  return (
    <Suspense fallback={<GamePageSkeleton />}>
      <QuoridorContent />
    </Suspense>
  );
}
