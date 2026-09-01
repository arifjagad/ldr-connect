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
import { GameSurrenderModal, GameSurrenderButton } from "@/components/games/GameSurrenderModal";
import { usePartnerProfile } from "@/lib/hooks/usePartnerProfile";
import type { QuoridorSession, QuoridorGameState } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "idle" | "waiting" | "playing" | "finished";
type FinishReason = "time_up" | "completed" | "expired" | null;

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

  // Pre-join lobby
  const [preJoinCode, setPreJoinCode]   = useState<string | null>(null);

  const [mode, setMode]           = useState<"move" | "wall">("move");
  const [wallOrient, setWallOrient] = useState<"H" | "V">("H");
  const [isActing, setIsActing]   = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin]     = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Video call
  const [showVideo, setShowVideo]       = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [realtimeOk, setRealtimeOk]     = useState(true);

  // Profil untuk share image
  const { profiles: shareProfiles } = usePartnerProfile(phase === "finished");

  // Realtime refs
  const supabaseRef   = useRef(createClient());
  const channelRef    = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const prevStatusRef = useRef<string | null>(null);
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
      window.history.replaceState({}, "", window.location.pathname);
      setJoinCodeInput(urlCode);
      setPreJoinCode(urlCode);
      setPhase("waiting");
      return;
    }

    fetch("/api/game/quoridor/session/active")
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

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.session_code) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setPartnerOnline(false);
      return;
    }

    const code     = session.session_code;
    const supabase = supabaseRef.current;
    const channel  = supabase
      .channel(`quoridor:${code}`)
      .on("broadcast", { event: "game_state_update" }, ({ payload }) => {
        const gs = payload?.game_state as QuoridorGameState | undefined;
        if (!gs) return;
        setGameState(gs);
        if (gs.winner) {
          setSession((prev) => prev ? { ...prev, status: "completed", game_state: gs } : prev);
          setFinishReason("completed");
          setPhase("finished");
        }
      })
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
          try {
            const res = await fetch(`/api/game/quoridor/session/${code}`);
            if (res.ok) {
              const data = await res.json();
              if (data.data?.session) applySession(data.data.session);
            }
          } catch { /* ignore */ }
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

    gameStateSnapshotRef.current = gameState;

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
        setGameState(gameStateSnapshotRef.current ?? optimistic);
        throw new Error(data.message ?? "Gagal bergerak");
      }
      const data = await res.json();
      if (!data.success) {
        setGameState(gameStateSnapshotRef.current ?? optimistic);
        throw new Error(data.message);
      }
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

    gameStateSnapshotRef.current = gameState;

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
    setShowConfirm(false);
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

  const isHostUser = !!(session && user && session.host_user_id === user.id);
  const isPartnerPreJoin = !!(preJoinCode && !session);
  const displayCode = session?.session_code ?? preJoinCode ?? "";

  return (
    <GamePageLayout
      gameName="Quoridor"
      gameEmoji="♟️"
      gameSlug="quoridor"
      gameSubtitle="Blokir jalur lawan, capai garis akhir duluan!"
      accentColor="#C84B31"
      accentColorLight="#B33E26"
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
            accentColor="#C84B31"
            accentColorLight="#B33E26"
            joinCodeInput={joinCodeInput}
            onJoinCodeChange={setJoinCodeInput}
            onJoin={handleJoin}
            joinLoading={loadingJoin}
            joinDisabled={loadingJoin || !joinCodeInput.trim()}
            createContent={
              <>
                <p className="mb-5 text-xs font-bold uppercase tracking-widest text-[#C84B31]">
                  Buat Game Baru
                </p>

                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#FBDCD5]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-[#1F1D1B]">Kamu jadi host</p>
                    <p className="text-xs text-[#78716C]">Partner join pakai session code</p>
                  </div>
                </div>

                {/* Rules summary */}
                <div className="mb-6 space-y-2 rounded-2xl border border-[#E7E5E4] bg-[#FCFBF7] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#78716C]">Cara Main</p>
                  {[
                    "Grid 9×9 — setiap giliran gerak ATAU pasang tembok",
                    "Kamu punya 10 tembok untuk digunakan",
                    "Host mulai dari baris paling atas, menuju baris bawah",
                    "Partner mulai dari baris paling bawah, menuju baris atas",
                    "Tembok tidak boleh memblokir total semua jalur lawan",
                    "Yang pertama mencapai baris tujuan = MENANG! ♟️",
                  ].map((rule, i) => (
                    <p key={i} className="flex items-start gap-2 text-[11px] text-[#78716C]">
                      <span className="mt-0.5 text-[#C84B31]">•</span> {rule}
                    </p>
                  ))}
                </div>

                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-5 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] cursor-pointer"
                >
                  Siapkan Papan →
                </button>
                <p className="mt-2 text-center text-[11px] text-[#78716C]">Memotong 3 coin</p>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
              <div
                className="absolute inset-0"
                onClick={() => !loadingCreate && setShowConfirm(false)}
              />
              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#E7E5E4] bg-white p-6 shadow-2xl">
                <div className="h-1.5 w-full bg-[#C84B31] absolute top-0 left-0" />
                <div className="pt-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C84B31]">Konfirmasi</p>
                  <h2 className="mt-1 font-serif text-xl font-bold text-[#1F1D1B]">Mulai game Quoridor?</h2>
                  <div className="my-5 space-y-2.5 text-xs text-[#78716C]">
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#C84B31]">•</span>
                      Papan 9×9 kosong disiapkan
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#C84B31]">•</span>
                      Setiap pemain mendapat <span className="font-semibold text-[#1F1D1B]">10 tembok</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#C84B31]">•</span>
                      <span><span className="font-semibold text-[#C84B31]">3 coin</span> akan dipotong</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#C84B31]">•</span>
                      Durasi game: <span className="font-semibold text-[#1F1D1B]">30 menit</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowConfirm(false)}
                      disabled={loadingCreate}
                      className="flex-1 rounded-xl border border-[#E7E5E4] bg-white py-2.5 text-xs font-semibold text-[#78716C] transition hover:border-[#D6D3D1] hover:text-[#1F1D1B] disabled:opacity-50 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateSession}
                      disabled={loadingCreate}
                      className="flex-1 rounded-xl bg-[#C84B31] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:opacity-50 cursor-pointer"
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
              statusColor={isMyTurn ? "#10B981" : "#78716C"}
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
                <div className="rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-xl shadow-black/2">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#78716C]">
                    Status Pemain
                  </p>
                  {/* Host */}
                  <div className="flex items-center gap-3 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3 py-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white shadow-xs"
                      style={{ background: "#C84B31" }}
                    >
                      ♟
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#1F1D1B]">
                        Host {myRole === "host" && <span className="text-[10px] font-bold text-[#10B981]">(Kamu)</span>}
                      </p>
                      <p className="text-[10px] text-[#78716C]">
                        Baris {gameState.host_pos.r + 1} · Kolom {gameState.host_pos.c + 1}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#C84B31]">{gameState.walls_left.host}🧱</span>
                  </div>
                  {/* Partner */}
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3 py-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white shadow-xs"
                      style={{ background: "#4F46E5" }}
                    >
                      ♟
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#1F1D1B]">
                        Partner {myRole === "partner" && <span className="text-[10px] font-bold text-[#10B981]">(Kamu)</span>}
                      </p>
                      <p className="text-[10px] text-[#78716C]">
                        Baris {gameState.partner_pos.r + 1} · Kolom {gameState.partner_pos.c + 1}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#4F46E5]">{gameState.walls_left.partner}🧱</span>
                  </div>
                  <p className="mt-2 text-[10px] font-medium text-[#78716C]">
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
                <div className="rounded-2xl border border-[#E7E5E4] bg-white p-3.5 shadow-xl shadow-black/2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#78716C]">Session Code</p>
                  <p className="mt-1 font-mono text-sm font-bold tracking-widest text-[#1F1D1B]">{session.session_code}</p>
                </div>

                {/* Surrender button */}
                <GameSurrenderButton onClick={() => setShowSurrenderConfirm(true)} />
              </div>
            </div>

            {/* Surrender Confirmation Modal */}
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
                <div className="flex justify-between text-xs text-[#78716C]">
                  <span>Session</span>
                  <span className="font-mono font-bold text-[#1F1D1B]">{session.session_code}</span>
                </div>
                <div className="flex justify-between text-xs text-[#78716C]">
                  <span>Pemenang</span>
                  <span className="font-semibold" style={{ color: finishReason === "time_up" ? "#D97706" : winnerIsMe ? "#10B981" : "#4F46E5" }}>
                    {finishReason === "time_up" ? "Waktu Habis" : winnerIsMe ? "Kamu 🏆" : partnerWon ? "Partner 🏆" : "Seri"}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#78716C]">
                  <span>Sisa tembok (Host)</span>
                  <span className="font-mono font-bold text-[#C84B31]">{gameState.walls_left.host}</span>
                </div>
                <div className="flex justify-between text-xs text-[#78716C]">
                  <span>Sisa tembok (Partner)</span>
                  <span className="font-mono font-bold text-[#4F46E5]">{gameState.walls_left.partner}</span>
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
