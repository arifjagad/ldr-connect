"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

type WaitingSession = {
  session_code: string;
  game_type: "tod" | "snake_ladder" | "quiz";
  host_user_id: string;
};

const GAME_LABELS: Record<string, string> = {
  tod: "Truth or Dare",
  snake_ladder: "Ular Tangga",
  quiz: "Quiz",
};

/**
 * Floating notification saat partner membuat sesi game dan menunggu kita join.
 * Menggunakan polling karena Supabase Realtime RLS tidak bisa lihat sesi partner
 * sebelum kita terdaftar sebagai partner_user_id.
 */
export function GameInviteNotification() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [invite, setInvite] = useState<WaitingSession | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const lastCodeRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Hanya poll jika user linked dengan partner
    if (!user?.partner_id) return;

    async function poll() {
      try {
        const res = await fetch("/api/game/tod/session/active");
        if (!res.ok) return;
        const json = await res.json();
        const session = json?.data?.session;

        if (
          session &&
          session.status === "waiting" &&
          session.host_user_id !== user!.id
        ) {
          // Partner yang buat sesi, bukan kita
          if (lastCodeRef.current !== session.session_code) {
            // Notif baru (kode berbeda dari sebelumnya) — reset dismissed
            lastCodeRef.current = session.session_code;
            setDismissed(false);
          }
          setInvite(session as WaitingSession);
        } else {
          // Tidak ada sesi menunggu dari partner
          setInvite(null);
        }
      } catch {
        // Ignore network errors
      }
    }

    poll(); // Langsung poll pertama kali
    intervalRef.current = setInterval(poll, 12000); // Setiap 12 detik

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.partner_id, user?.id]);

  function handleJoin() {
    if (!invite) return;
    setInvite(null);
    setDismissed(true);
    router.push(`/dashboard/games/tod?join=${invite.session_code}`);
  }

  if (!invite || dismissed) return null;

  return (
    <div className="fixed top-20 right-4 z-50 w-80 animate-slide-in-right">
      <div className="overflow-hidden rounded-2xl border border-[#FF3D7F]/30 bg-[#0E0E12]/95 shadow-2xl shadow-[#FF3D7F]/10 backdrop-blur-md">
        {/* Top accent */}
        <div className="h-0.5 bg-linear-to-r from-[#FF3D7F] to-[#818CF8]" />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF3D7F]/15">
                <span className="text-lg">🎮</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#FF6B9D] uppercase tracking-wide">
                  Game Invite!
                </p>
                <p className="text-sm font-semibold text-[#FFF5F8]">
                  Partner mengajakmu main
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-lg p-1 text-[#5C5470] transition hover:bg-white/5 hover:text-[#9B93B0]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Game info */}
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
            <p className="text-xs text-[#5C5470]">Game</p>
            <p className="text-sm font-semibold text-[#FFF5F8]">
              {GAME_LABELS[invite.game_type] ?? invite.game_type}
            </p>
            <p className="mt-1 font-mono text-[10px] text-[#5C5470]">
              Kode: {invite.session_code}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleJoin}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FF3D7F] py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(255,61,127,0.35)] transition hover:bg-[#FF6B9D]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Bergabung Sekarang
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-[#9B93B0] transition hover:bg-white/10"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
