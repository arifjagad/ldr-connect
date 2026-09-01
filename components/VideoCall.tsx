"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallStatus = "idle" | "fetching-room" | "connecting" | "connected" | "error";

interface VideoCallProps {
  /** Session code, dipakai untuk fetch room URL dari server */
  sessionCode: string;
  /** Nama game, menentukan endpoint room yang dipakai */
  game?: "tod" | "snake-ladder" | "dare-derby" | "quoridor";
  onLeave?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoCall({ sessionCode, game = "tod", onLeave }: VideoCallProps) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [minimized, setMinimized] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // ── Track helpers (component-scoped so they can be called on re-mount) ──────

  function attachLocalTrack() {
    const call = callRef.current;
    if (!call) return;
    const local = call.participants()?.local;
    if (!local) return;
    const track = local.tracks?.video?.persistentTrack;
    if (track && localVideoRef.current) {
      localVideoRef.current.srcObject = new MediaStream([track]);
      localVideoRef.current.play().catch(() => {});
    }
  }

  function attachTracks() {
    const call = callRef.current;
    if (!call) return;
    const participants = call.participants();
    for (const p of Object.values(participants) as { local: boolean; tracks: Record<string, { persistentTrack?: MediaStreamTrack }> }[]) {
      const videoTrack = p.tracks?.video?.persistentTrack;
      if (!videoTrack) continue;
      if (p.local && localVideoRef.current) {
        localVideoRef.current.srcObject = new MediaStream([videoTrack]);
        localVideoRef.current.play().catch(() => {});
      } else if (!p.local && remoteVideoRef.current) {
        const audioTrack = p.tracks?.audio?.persistentTrack;
        const tracks: MediaStreamTrack[] = [videoTrack];
        if (audioTrack) tracks.push(audioTrack);
        remoteVideoRef.current.srcObject = new MediaStream(tracks);
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function checkRemote(call: any) {
    const participants = call.participants() as Record<string, { local?: boolean }>;
    const remoteExists = Object.values(participants).some(
      (p: { local?: boolean }) => !p.local
    );
    setHasRemote(remoteExists);
  }

  // ── Re-attach tracks when panel is restored after minimize ──────────────────
  useEffect(() => {
    if (!minimized && status === "connected") {
      attachLocalTrack();
      attachTracks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized]);

  // ── Main call setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;

    async function init() {
      setStatus("fetching-room");
      setErrorMsg(null);

      // 1. Ambil room URL dari server (sekaligus create jika belum ada)
      let roomUrl: string;
      try {
        const res = await fetch(`/api/game/${game}/session/${sessionCode}/room`);
        const json = await res.json();
        if (!res.ok || !json.data?.room_url) {
          throw new Error(json.message ?? "Gagal mendapatkan room video");
        }
        roomUrl = json.data.room_url;
      } catch (e) {
        if (!destroyed) {
          setStatus("error");
          setErrorMsg((e as Error).message);
        }
        return;
      }

      if (destroyed) return;
      setStatus("connecting");

      // 2. Load Daily.co dan join
      try {
        const { default: DailyIframe } = await import("@daily-co/daily-js");
        if (destroyed) return;

        const call = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: true,
        });
        callRef.current = call;

        // ── Event handlers ──

        call.on("joined-meeting", () => {
          if (destroyed) return;
          setStatus("connected");
          attachLocalTrack();
        });

        call.on("participant-updated", () => {
          if (destroyed) return;
          attachTracks();
          checkRemote(call);
        });

        call.on("participant-joined", () => {
          if (destroyed) return;
          attachTracks();
          setHasRemote(true);
        });

        call.on("participant-left", () => {
          if (destroyed) return;
          checkRemote(call);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        });

        call.on("error", (err: { errorMsg?: string; error?: { type?: string; msg?: string } }) => {
          if (destroyed) return;
          const msg =
            err?.errorMsg ??
            err?.error?.msg ??
            "Koneksi video gagal";
          if (msg.includes("missing-payment-method") || msg.includes("payment")) {
            setErrorMsg("Akun Daily.co perlu payment method. Cek dashboard Daily.co.");
          } else {
            setErrorMsg(msg);
          }
          setStatus("error");
        });

        await call.join({ url: roomUrl });
      } catch (e) {
        if (!destroyed) {
          setStatus("error");
          setErrorMsg("Tidak dapat memulai video call");
          console.error("[VideoCall] init error:", e);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy().catch(() => {});
        callRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  async function toggleAudio() {
    if (!callRef.current) return;
    await callRef.current.setLocalAudio(audioMuted);
    setAudioMuted((v) => !v);
  }

  async function toggleVideo() {
    if (!callRef.current) return;
    await callRef.current.setLocalVideo(videoMuted);
    setVideoMuted((v) => !v);
  }

  async function leaveCall() {
    if (callRef.current) {
      await callRef.current.leave().catch(() => {});
    }
    onLeave?.();
  }

  // ── Status label helper ──────────────────────────────────────────────────────

  const statusLabel =
    status === "fetching-room" ? "Menyiapkan room…" :
    status === "connecting"    ? "Menghubungkan…" :
    status === "connected"     ? (hasRemote ? "Video aktif" : "Menunggu partner…") :
    status === "error"         ? "Gagal" : "Memulai…";

  // ── Minimized pill ───────────────────────────────────────────────────────────

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-[#E7E5E4] bg-white/95 px-4 py-2.5 shadow-2xl shadow-black/10 backdrop-blur-md">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "connected"
              ? "bg-[#10B981] shadow-[0_0_6px_#10B981]"
              : status === "connecting" || status === "fetching-room"
              ? "animate-pulse bg-[#D97706]"
              : "bg-red-500"
          }`}
        />
        <span className="text-xs font-semibold text-[#78716C]">{statusLabel}</span>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="ml-1 rounded-lg border border-[#E7E5E4] bg-[#FCFBF7] p-1.5 text-[#78716C] transition hover:bg-white hover:text-[#1F1D1B] cursor-pointer shadow-2xs"
          title="Buka video"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Full panel ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-64 flex-col overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-2xl shadow-black/10 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#F5F5F4] px-3 py-2 bg-[#FCFBF7]">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "connected"
                ? "bg-[#10B981] shadow-[0_0_5px_#10B981]"
                : status === "connecting" || status === "fetching-room"
                ? "animate-pulse bg-[#D97706]"
                : "bg-red-500"
            }`}
          />
          <span className="text-[10px] font-semibold text-[#78716C]">
            {statusLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="rounded-lg p-1 text-[#78716C] transition hover:bg-white hover:text-[#1F1D1B] cursor-pointer"
          title="Perkecil"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Video area */}
      <div className="relative aspect-video w-full bg-[#1F1D1B]">
        {status === "connected" && hasRemote ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3">
            {(status === "fetching-room" || status === "connecting") && (
              <>
                <svg className="animate-spin text-[#C84B31]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
                <span className="text-center text-[10px] text-[#A8A29E]">{statusLabel}</span>
              </>
            )}
            {status === "connected" && !hasRemote && (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white">👤</div>
                <span className="text-[10px] text-[#A8A29E]">Menunggu partner…</span>
              </>
            )}
            {status === "error" && (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-center text-[10px] leading-relaxed text-red-400">{errorMsg}</span>
              </>
            )}
          </div>
        )}

        {/* Local video PiP */}
        {status === "connected" && !videoMuted && (
          <div className="absolute bottom-2 left-2 h-16 w-20 overflow-hidden rounded-lg border border-white/20 bg-[#1F1D1B]">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          </div>
        )}
        {status === "connected" && videoMuted && (
          <div className="absolute bottom-2 left-2 flex h-16 w-20 items-center justify-center rounded-lg border border-white/20 bg-[#292524]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
            </svg>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-[#F5F5F4] px-3 py-2 bg-white">
        <button
          type="button"
          onClick={toggleAudio}
          disabled={status !== "connected"}
          title={audioMuted ? "Unmute mikrofon" : "Mute mikrofon"}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition disabled:opacity-40 cursor-pointer ${
            audioMuted ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-[#FCFBF7] border border-[#E7E5E4] text-[#78716C] hover:text-[#1F1D1B] hover:bg-white"
          }`}
        >
          {audioMuted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={toggleVideo}
          disabled={status !== "connected"}
          title={videoMuted ? "Nyalakan kamera" : "Matikan kamera"}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition disabled:opacity-40 cursor-pointer ${
            videoMuted ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-[#FCFBF7] border border-[#E7E5E4] text-[#78716C] hover:text-[#1F1D1B] hover:bg-white"
          }`}
        >
          {videoMuted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={leaveCall}
          title="Tutup video call"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-600 transition hover:bg-red-100 cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
