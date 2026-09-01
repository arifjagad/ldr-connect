"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

type WaitingSession = {
  session_code: string;
  game_type: string;
  host_user_id: string;
  status: string;
};

const GAME_LABELS: Record<string, string> = {
  tod:          "Truth or Dare",
  snake_ladder: "Ular Tangga",
  dare_derby:   "Dare Derby",
  quoridor:     "Quoridor",
};

const GAME_ROUTES: Record<string, string> = {
  tod:          "/dashboard/games/tod",
  snake_ladder: "/dashboard/games/snake-ladder",
  dare_derby:   "/dashboard/games/dare-derby",
  quoridor:     "/dashboard/games/quoridor",
};

export function GameInviteNotification() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [invite, setInvite] = useState<WaitingSession | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const lastCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !user.partner_id) return;

    // LEAST(user.id, partner_id) — konsisten dengan couple_id di DB
    const coupleId = [user.id, user.partner_id].sort()[0];
    const supabase = createClient();

    async function fetchExistingInvite() {
      try {
        const res = await fetch("/api/game/session/any-active");
        if (!res.ok) return;
        const json = await res.json();
        const session = json?.data?.session;
        if (session?.status === "waiting" && session.host_user_id !== user!.id) {
          if (lastCodeRef.current !== session.session_code) {
            lastCodeRef.current = session.session_code;
            setDismissed(false);
          }
          setInvite(session as WaitingSession);
        }
      } catch { /* ignore */ }
    }

    // Reset state saat couple_id berubah (partner unlink → relink)
    setInvite(null);
    setDismissed(false);
    lastCodeRef.current = null;

    const channel = supabase
      .channel(`couple-invites:${coupleId}`)
      .on("broadcast", { event: "game_invite" }, ({ payload }) => {
        const session = payload as WaitingSession;
        if (session.host_user_id === user!.id) return;
        if (lastCodeRef.current !== session.session_code) {
          lastCodeRef.current = session.session_code;
          setDismissed(false);
        }
        setInvite(session);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Satu kali fetch saat pertama connect — tangkap invite yang sudah ada
          await fetchExistingInvite();
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, user?.partner_id]);

  function handleJoin() {
    if (!invite) return;
    setInvite(null);
    setDismissed(true);
    const base = GAME_ROUTES[invite.game_type] ?? "/dashboard/games";
    router.push(`${base}?join=${invite.session_code}`);
  }

  if (!invite || dismissed) return null;

  return (
    <div className="fixed top-20 left-4 right-4 z-50 animate-slide-in-right sm:left-auto sm:right-4 sm:w-80">
      <div className="overflow-hidden rounded-2xl border border-[#FBDCD5] bg-white shadow-2xl shadow-black/10 backdrop-blur-md">
        <div className="h-1 bg-[#C84B31]" />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDF4F2] border border-[#FBDCD5]">
                <span className="text-lg">🎮</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#C84B31] uppercase tracking-wider">
                  Game Invite!
                </p>
                <p className="text-xs font-serif font-bold text-[#1F1D1B]">
                  Partner mengajakmu main
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-lg p-1 text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3 py-2.5">
            <p className="text-[10px] font-semibold text-[#78716C]">Game</p>
            <p className="text-xs font-bold text-[#1F1D1B]">
              {GAME_LABELS[invite.game_type] ?? invite.game_type}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-[#78716C]">
              Kode: {invite.session_code}
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleJoin}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#C84B31] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Gabung
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-xl border border-[#E7E5E4] bg-white px-3 text-xs font-semibold text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer shadow-2xs"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
