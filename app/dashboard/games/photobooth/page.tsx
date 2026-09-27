"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { GamePageLayout, GamePageSkeleton } from "@/components/games/GamePageLayout";
import { GamePlayingHeader } from "@/components/games/GamePlayingHeader";
import { GameIdleLayout, GameRulesList } from "@/components/games/GameIdleLayout";
import { VideoCall } from "@/components/VideoCall";
import { emitCoinBalanceUpdated } from "@/lib/hooks/use-server-balance";
import type { PhotoboothSession, PhotoboothTemplate, PhotoboothSlot, PhotoboothPhoto } from "@/lib/types";

type Phase = "idle" | "waiting" | "playing" | "finished";

function PhotoboothContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [joinCodeInput, setJoinCodeInput] = useState(
    searchParams?.get("join")?.toUpperCase() ?? ""
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<PhotoboothSession | null>(null);
  const [templates, setTemplates] = useState<PhotoboothTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Video call & Webcam
  const [showVideo, setShowVideo] = useState(true);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Countdown & Capture
  const [countdown, setCountdown] = useState<number | null>(null);

  // Foto disimpan sebagai path di bucket privat (migration 041). Payload
  // realtime hanya membawa path, signed URL-nya diambil dari GET sesi.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef<Record<string, string>>({});
  const fetchingUrlsRef = useRef(false);
  const latestSessionRef = useRef<PhotoboothSession | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const currentTemplate = session?.board_config?.template as PhotoboothTemplate | undefined;
  const currentSlotIndex = session?.game_state?.current_slot ?? 1;
  const currentPhotos = (session?.game_state?.photos ?? {}) as Record<number, PhotoboothPhoto>;
  const currentPhaseState = session?.game_state?.phase ?? "ready";
  const retakesLeft = session?.game_state?.retakes_left ?? 3;

  // ── Fetch templates ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/game/photobooth/templates")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.data?.templates)) {
          setTemplates(json.data.templates);
          if (json.data.templates.length > 0) {
            setSelectedTemplateId(json.data.templates[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // ── Setup Local Webcam ───────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      if (localStreamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCameraError(null);
    } catch (err: unknown) {
      console.error("[Photobooth] Kamera gagal:", err);
      setCameraError("Izin kamera diperlukan untuk mengambil foto.");
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (phase === "playing" || phase === "waiting") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [phase, startCamera, stopCamera]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (!session) return;
    setPhase("finished");
    fetch(`/api/game/photobooth/session/${session.session_code}/expire`, { method: "POST" }).catch(() => {});
  }, [session]);

  const timerSeconds = useCountdown(
    phase === "playing" ? session?.expires_at ?? null : null,
    handleTimerExpire
  );

  // ── Photo URL Cache ─────────────────────────────────────────────────────────
  const harvestPhotoUrls = useCallback((s: PhotoboothSession | null) => {
    const found: Record<string, string> = {};
    for (const photo of Object.values(s?.game_state?.photos ?? {}) as PhotoboothPhoto[]) {
      if (photo.host_image_path && photo.host_image_url) found[photo.host_image_path] = photo.host_image_url;
      if (photo.partner_image_path && photo.partner_image_url) found[photo.partner_image_path] = photo.partner_image_url;
    }
    if (Object.keys(found).length === 0) return;
    photoUrlsRef.current = { ...photoUrlsRef.current, ...found };
    setPhotoUrls(photoUrlsRef.current);
  }, []);

  const ensurePhotoUrls = useCallback(async (s: PhotoboothSession, attempt = 0) => {
    latestSessionRef.current = s;
    const hasMissing = (x: PhotoboothSession) =>
      (Object.values(x.game_state?.photos ?? {}) as PhotoboothPhoto[])
        .flatMap((p) => [p.host_image_path, p.partner_image_path])
        .some((path) => path && !photoUrlsRef.current[path]);
    if (!hasMissing(s) || fetchingUrlsRef.current) return;

    fetchingUrlsRef.current = true;
    try {
      const res = await fetch(`/api/game/photobooth/session/${s.session_code}`);
      const json = await res.json().catch(() => null);
      if (res.ok) harvestPhotoUrls(json?.data?.session ?? null);
    } finally {
      fetchingUrlsRef.current = false;
    }

    // Path baru bisa datang lewat realtime selama fetch di atas berjalan.
    const latest = latestSessionRef.current;
    if (latest && attempt < 3 && hasMissing(latest)) ensurePhotoUrls(latest, attempt + 1);
  }, [harvestPhotoUrls]);

  function photoSrc(photo: PhotoboothPhoto | undefined): string | undefined {
    if (!photo) return undefined;
    return (
      (photo.host_image_path && photoUrls[photo.host_image_path]) ||
      (photo.partner_image_path && photoUrls[photo.partner_image_path]) ||
      photo.host_image_url ||
      photo.partner_image_url ||
      photo.combined_image_url
    );
  }

  // ── Apply Session State ─────────────────────────────────────────────────────
  const applySession = useCallback((s: PhotoboothSession | null) => {
    if (!s) {
      setSession(null);
      setPhase("idle");
      return;
    }
    setSession(s);
    harvestPhotoUrls(s);
    ensurePhotoUrls(s);
    if (s.status === "waiting") setPhase("waiting");
    else if (s.status === "playing") setPhase("playing");
    else if (s.status === "completed" || s.status === "expired" || s.status === "cancelled") {
      setPhase("finished");
    }
  }, [harvestPhotoUrls, ensurePhotoUrls]);

  // ── Check Active Session ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/game/photobooth/session/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.data?.session) {
          applySession(json.data.session);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // ── Realtime Subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const supabase = supabaseRef.current;
    const sessionCode = session.session_code;

    const channel = supabase
      .channel(`photobooth:${sessionCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `session_code=eq.${sessionCode}`,
        },
        (payload) => {
          const updated = payload.new as PhotoboothSession;
          if (updated) applySession(updated);
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setPartnerOnline(count >= 2);
      })
      .subscribe((status) => {
        setRealtimeOk(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED" && user) {
          channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [session?.session_code, user, applySession, session]);

  // ── Countdown Handler (5 seconds) ──────────────────────────────────────────
  useEffect(() => {
    if (!session?.game_state?.countdown_started_at) {
      setCountdown(null);
      return;
    }

    const startTime = session.game_state.countdown_started_at;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = 5 - elapsed;
      if (remaining <= 0) {
        setCountdown(0);
        clearInterval(interval);
        triggerLocalCapture();
      } else {
        setCountdown(remaining);
      }
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.game_state?.countdown_started_at]);

  // ── Capture Photo from Local Video Stream ───────────────────────────────────
  async function triggerLocalCapture() {
    if (!localVideoRef.current || isCapturing || !session) return;
    setIsCapturing(true);

    try {
      const video = localVideoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      const res = await fetch(`/api/game/photobooth/session/${session.session_code}/submit-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_index: session.game_state.capture?.slot ?? session.game_state.current_slot,
          image_url: dataUrl,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message || "Gagal menyimpan foto");
      }
    } catch (e) {
      console.error("[Photobooth] Gagal capture:", e);
      toast.error("Gagal mengambil foto, silakan coba lagi");
    } finally {
      setIsCapturing(false);
      setCountdown(null);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleCreateSession() {
    setLoadingCreate(true);
    try {
      const res = await fetch("/api/game/photobooth/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplateId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal membuat sesi");
      applySession(json.data.session);
      emitCoinBalanceUpdated();
      toast.success("Sesi Photobooth berhasil dibuat!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat sesi";
      toast.error(msg);
    } finally {
      setLoadingCreate(false);
      setShowConfirm(false);
    }
  }

  function handleLeave() {
    // Beri tahu server sebelum reset state lokal — tanpa ini, sesi 'waiting'
    // atau 'playing' yang ditinggalkan tidak pernah ditandai selesai di DB
    // (coin tetap tertahan, partner masih melihatnya sebagai aktif) sampai
    // timer/cron membersihkannya.
    if (session?.status === "waiting" && session.host_user_id === user?.id) {
      fetch(`/api/game/session/${session.session_code}/cancel`, { method: "POST" }).catch(() => {});
    } else if (session?.status === "playing") {
      fetch(`/api/game/photobooth/session/${session.session_code}/expire`, { method: "POST" }).catch(() => {});
    }
    setSession(null);
    setPhase("idle");
  }

  async function handleJoinSession(code?: string) {
    const targetCode = (code ?? joinCodeInput).trim().toUpperCase();
    if (!targetCode) return;
    setLoadingJoin(true);
    try {
      const res = await fetch("/api/game/photobooth/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_code: targetCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal bergabung");
      applySession(json.data.session);
      toast.success("Berhasil bergabung ke sesi Photobooth!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal bergabung ke sesi";
      toast.error(msg);
    } finally {
      setLoadingJoin(false);
    }
  }

  async function handleTriggerCountdown() {
    if (!session) return;
    try {
      const res = await fetch(`/api/game/photobooth/session/${session.session_code}/trigger-countdown`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message || "Gagal memulai countdown");
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRetake(slotIdx: number) {
    if (!session) return;
    if (retakesLeft <= 0) {
      toast.error("Kuota retake foto sudah habis (maks 3x)");
      return;
    }
    try {
      const res = await fetch(`/api/game/photobooth/session/${session.session_code}/retake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_index: slotIdx }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message || "Gagal memulai retake");
        return;
      }
      toast.info(`Slot ${slotIdx} siap difoto ulang`);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCompleteSession() {
    if (!session) return;
    try {
      const res = await fetch(`/api/game/photobooth/session/${session.session_code}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message || "Gagal menyelesaikan sesi");
        return;
      }
      setPhase("finished");
      toast.success("Sesi photobooth selesai!");
    } catch (e) {
      console.error(e);
    }
  }

  // ── Download Composite Canvas ───────────────────────────────────────────────
  async function handleDownloadFinalPhoto() {
    if (!currentTemplate) return;
    setDownloading(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = currentTemplate.canvas_width || 600;
      canvas.height = currentTemplate.canvas_height || 1800;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context tidak tersedia");

      // 1. Gambar latar belakang
      ctx.fillStyle = "#111113";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Gambar setiap slot foto
      const slots: PhotoboothSlot[] = currentTemplate.slots || [];
      for (const slot of slots) {
        const photo = currentPhotos[slot.index];
        const imgUrl = photoSrc(photo);
        if (imgUrl) {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          await new Promise((resolve) => {
            img.onload = () => {
              ctx.save();
              if (slot.rounded) {
                ctx.beginPath();
                ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.rounded);
                ctx.clip();
              }
              ctx.drawImage(img, slot.x, slot.y, slot.width, slot.height);
              ctx.restore();
              resolve(true);
            };
            img.onerror = () => resolve(false);
            img.src = imgUrl;
          });
        }
      }

      // 3. Gambar frame overlay PNG transparan
      if (currentTemplate.image_url) {
        const frameImg = new window.Image();
        frameImg.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          frameImg.onload = () => {
            ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
            resolve(true);
          };
          frameImg.onerror = () => resolve(false);
          frameImg.src = currentTemplate.image_url;
        });
      }

      // 4. Download file
      const downloadUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `photobooth-${session?.session_code || "couple"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Foto photobooth berhasil diunduh!");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal mengunduh foto");
    } finally {
      setDownloading(false);
    }
  }

  // ── Derived Props for GamePageLayout ────────────────────────────────────────
  const isHostUser = !!(session && user && session.host_user_id === user.id);
  const displayCode = session?.session_code ?? joinCodeInput ?? "";
  const totalSlots = currentTemplate?.photo_count ?? 3;
  const isReview = currentPhaseState === "review_retake";

  return (
    <GamePageLayout
      gameName="Virtual Photobooth"
      gameEmoji="📸"
      gameSlug="photobooth"
      gameSubtitle="Abadikan momen romantis bersama pasangan via video call dan strip frame foto!"
      accentColor="#EC4899"
      accentColorLight="#F472B6"
      phase={phase}
      // Waiting
      sessionCode={displayCode}
      isHost={isHostUser}
      onCancel={handleLeave}
      onJoin={() => handleJoinSession()}
      joinLoading={loadingJoin}
      expiryMinutes={10}
      waitingExtraInfo={
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#09090B] p-3 text-left">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className={`h-2 w-2 rounded-full ${cameraActive ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
              {cameraActive ? "Kamera Kamu Siap" : "Menghubungkan Kamera..."}
            </span>
            <span className="text-[10px] text-[#5C5470]">Preview Lokal</span>
          </div>
          {cameraError ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-3 text-center text-xs text-rose-300">
              {cameraError}
            </div>
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/6 bg-black shadow-inner">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover -scale-x-100"
              />
            </div>
          )}
        </div>
      }
      // Playing
      realtimeOk={realtimeOk}
      showVideo={showVideo}
      videoSessionCode={session?.session_code}
      videoGame="photobooth"
      onVideoLeave={() => setShowVideo(false)}
      // Idle
      idleContent={
        <>
          <GameIdleLayout
            accentColor="#EC4899"
            accentColorLight="#F472B6"
            joinCodeInput={joinCodeInput}
            onJoinCodeChange={setJoinCodeInput}
            onJoin={() => handleJoinSession()}
            joinLoading={loadingJoin}
            createContent={
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#5C5470]">
                  Pilih Frame Photobooth
                </p>

                {/* Template Picker */}
                <div className="mb-6 grid grid-cols-2 gap-3">
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`group relative flex flex-col items-center rounded-xl border p-3 text-left transition ${
                        selectedTemplateId === tmpl.id
                          ? "border-[#EC4899] bg-[#EC4899]/10 shadow-[0_0_15px_rgba(236,72,153,0.2)]"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="relative mb-2 h-28 w-12 overflow-hidden rounded-md border border-white/10 bg-black/40">
                        <Image
                          src={tmpl.thumbnail_url || tmpl.image_url}
                          alt={tmpl.name}
                          fill
                          className="object-contain p-1"
                          unoptimized
                        />
                      </div>
                      <span className="line-clamp-1 text-xs font-bold text-[#FFF5F8]">{tmpl.name}</span>
                      <span className="text-[10px] text-[#9B93B0]">{tmpl.photo_count} Foto • {tmpl.aspect_ratio}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EC4899] py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(236,72,153,0.35)] transition hover:bg-[#F43F5E]"
                >
                  <span>📸</span> Buat Sesi Photobooth
                </button>
                <p className="mt-2 text-center text-[10px] text-[#5C5470]">Memotong 3 coin</p>
              </div>
            }
            joinContent={
              <GameRulesList
                rules={[
                  "Hubungkan kamera dan nyalakan video call dengan pasangan.",
                  "Pilih frame strip estetik (misal: Strip 2x6 - 3 Foto).",
                  "Klik tombol ambil foto untuk memicu countdown 5 detik.",
                  "Di detik ke-0, kamera kamu & pasangan akan mengambil pose terbaik.",
                  "Setelah selesai, bisa retake foto hingga 3 kali lalu download hasilnya!",
                ]}
              />
            }
          />

          {/* Confirm Modal */}
          {showConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => !loadingCreate && setShowConfirm(false)}
              />
              <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#EC4899]/25 bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
                <div className="h-0.5 w-full bg-linear-to-r from-[#EC4899] to-[#F472B6]" />
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#EC4899]">Konfirmasi</p>
                  <h2 className="mt-1 text-xl font-bold text-[#FFF5F8]">Mulai Sesi Photobooth?</h2>
                  <div className="my-5 space-y-2.5 text-sm text-[#9B93B0]">
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#5C5470]">•</span>
                      Webcam HD &amp; Video Call interaktif diaktifkan
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#5C5470]">•</span>
                      Maksimal <span className="font-semibold text-[#FFF5F8]">3x Retake foto</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#5C5470]">•</span>
                      <span><span className="font-semibold text-[#FF6B9D]">3 coin</span> akan dipotong</span>
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
                      className="flex-1 rounded-xl bg-[#EC4899] py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(236,72,153,0.35)] transition hover:bg-[#F43F5E] disabled:opacity-50"
                    >
                      {loadingCreate ? "Membuat..." : "Mulai (3 Coin)"}
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
        <div className="space-y-6">
          <GamePlayingHeader
            sessionCode={session?.session_code}
            statusText={isReview ? "Review & Retake Studio" : `Ambil Foto ${currentSlotIndex} dari ${totalSlots}`}
            statusColor="#EC4899"
            timerSeconds={timerSeconds}
            partnerOnline={partnerOnline}
            showVideo={showVideo}
            onToggleVideo={() => setShowVideo((v) => !v)}
            onLeave={handleLeave}
            realtimeOk={realtimeOk}
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Main Stage: Camera & Countdown */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#111113] p-6">
              {/* Countdown Overlay */}
              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                  <div className="animate-ping text-8xl font-black text-[#EC4899]">
                    {countdown}
                  </div>
                </div>
              )}

              {/* Flash Effect on Capture */}
              {isCapturing && (
                <div className="absolute inset-0 z-40 bg-white duration-300 animate-out fade-out" />
              )}

              {/* Live Camera Feed */}
              <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover -scale-x-100"
                />
                <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                  📸 Kamera Siap • Slot {currentSlotIndex}
                </div>
              </div>

              {/* Control Bar */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {!isReview ? (
                  <button
                    onClick={() => handleTriggerCountdown()}
                    disabled={countdown !== null}
                    className="flex items-center gap-2 rounded-2xl bg-[#EC4899] px-8 py-3 text-base font-bold text-white shadow-[0_4px_20px_rgba(236,72,153,0.4)] transition hover:bg-[#F43F5E] disabled:opacity-50"
                  >
                    <span>📷</span> Ambil Foto (5s)
                  </button>
                ) : (
                  <button
                    onClick={handleCompleteSession}
                    className="flex items-center gap-2 rounded-2xl bg-[#10B981] px-8 py-3 text-base font-bold text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition hover:bg-[#34D399]"
                  >
                    <span>✨</span> Selesai &amp; Unduh Hasil
                  </button>
                )}
              </div>
            </div>

            {/* Right Sidebar: Strip Frame Live Preview */}
            <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-[#111113] p-5">
              <div className="mb-4 flex w-full items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs font-bold text-[#FFF5F8]">{currentTemplate?.name}</p>
                  <p className="text-[10px] text-[#9B93B0]">Sisa Retake: {retakesLeft}x</p>
                </div>
              </div>

              {/* Live Strip Frame Canvas Simulation */}
              <div
                className="relative h-[540px] w-[180px] overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-xl"
                style={{ aspectRatio: currentTemplate?.aspect_ratio || "2:6" }}
              >
                {/* Render Photo Slots */}
                {(currentTemplate?.slots || []).map((slot) => {
                  const photo = currentPhotos[slot.index];
                  const img = photoSrc(photo);
                  const scaleW = 180 / (currentTemplate?.canvas_width || 600);
                  const scaleH = 540 / (currentTemplate?.canvas_height || 1800);

                  return (
                    <div
                      key={slot.index}
                      className={`absolute overflow-hidden border ${
                        currentSlotIndex === slot.index && !isReview
                          ? "border-[#EC4899] ring-2 ring-[#EC4899]/50"
                          : "border-white/10"
                      }`}
                      style={{
                        left: `${slot.x * scaleW}px`,
                        top: `${slot.y * scaleH}px`,
                        width: `${slot.width * scaleW}px`,
                        height: `${slot.height * scaleH}px`,
                        borderRadius: `${(slot.rounded || 8) * scaleW}px`,
                      }}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={`Slot ${slot.index}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5 text-[10px] text-[#5C5470]">
                          Slot {slot.index}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Overlay Frame Image */}
                {currentTemplate?.image_url && (
                  <div className="pointer-events-none absolute inset-0">
                    <Image
                      src={currentTemplate.image_url}
                      alt="Frame Overlay"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* Retake buttons list in review mode */}
              {isReview && (
                <div className="mt-4 w-full space-y-1.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#5C5470]">
                    Ulangi Foto:
                  </p>
                  {(currentTemplate?.slots || []).map((slot) => (
                    <button
                      key={slot.index}
                      onClick={() => handleRetake(slot.index)}
                      disabled={retakesLeft <= 0}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#9B93B0] transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                    >
                      <span>Foto #{slot.index}</span>
                      <span className="text-[10px] text-[#EC4899]">Retake ↺</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Video call Daily.co Floating Panel */}
          {showVideo && session?.session_code && (
            <VideoCall
              sessionCode={session.session_code}
              game="photobooth"
              onLeave={() => setShowVideo(false)}
            />
          )}
        </div>
      }
      // Finished
      finishedContent={
        <div className="mx-auto flex max-w-lg flex-col items-center">
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#111113] p-4 shadow-2xl">
            <div className="relative h-[600px] w-[200px] overflow-hidden rounded-xl border border-white/10 bg-black">
              {(currentTemplate?.slots || []).map((slot) => {
                const photo = currentPhotos[slot.index];
                const img = photoSrc(photo);
                const scaleW = 200 / (currentTemplate?.canvas_width || 600);
                const scaleH = 600 / (currentTemplate?.canvas_height || 1800);

                return (
                  <div
                    key={slot.index}
                    className="absolute overflow-hidden border border-white/10"
                    style={{
                      left: `${slot.x * scaleW}px`,
                      top: `${slot.y * scaleH}px`,
                      width: `${slot.width * scaleW}px`,
                      height: `${slot.height * scaleH}px`,
                      borderRadius: `${(slot.rounded || 8) * scaleW}px`,
                    }}
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={`Slot ${slot.index}`} className="h-full w-full object-cover" />
                    )}
                  </div>
                );
              })}

              {currentTemplate?.image_url && (
                <div className="pointer-events-none absolute inset-0">
                  <Image
                    src={currentTemplate.image_url}
                    alt="Frame Overlay"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full gap-3">
            <button
              onClick={handleDownloadFinalPhoto}
              disabled={downloading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#EC4899] py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(236,72,153,0.35)] transition hover:bg-[#F43F5E]"
            >
              {downloading ? "Memproses..." : "📥 Unduh Foto (PNG)"}
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#9B93B0] hover:bg-white/10 hover:text-white"
            >
              Kembali
            </button>
          </div>
        </div>
      }
    />
  );
}

export default function PhotoboothPage() {
  return (
    <Suspense fallback={<GamePageSkeleton />}>
      <PhotoboothContent />
    </Suspense>
  );
}
