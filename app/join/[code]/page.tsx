"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * /join/[code] — Quick join link.
 * 1. Cek apakah user sudah login (API akan return 401 jika belum)
 * 2. Fetch game_type dari /api/game/session/[code] menggunakan service client
 *    (bypass RLS — agar bisa dibaca sebelum partner_user_id terisi)
 * 3. Redirect ke halaman game yang sesuai dengan ?join=CODE
 */

const GAME_ROUTES: Record<string, string> = {
  tod: "/dashboard/games/tod",
  snake_ladder: "/dashboard/games/snake",
  quiz: "/dashboard/games/quiz",
};

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string ?? "").toUpperCase();

  useEffect(() => {
    if (!code) {
      router.replace("/dashboard/games");
      return;
    }

    async function checkAndRedirect() {
      // Gunakan API route (service client) agar bisa baca session
      // meski partner_user_id masih NULL (belum join)
      const res = await fetch(`/api/game/session/${code}`);

      if (res.status === 401) {
        router.replace(`/auth/login?redirect=/join/${code}`);
        return;
      }

      const data = await res.json();
      const gameType: string = data?.data?.game_type ?? "tod";
      const gamePath = GAME_ROUTES[gameType] ?? "/dashboard/games/tod";

      router.replace(`${gamePath}?join=${code}`);
    }

    checkAndRedirect();
  }, [code, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#818CF8]/15">
          <span className="text-3xl">🎮</span>
        </div>
        <p className="text-sm font-medium text-[#9B93B0]">Mengarahkan ke game…</p>
        <p className="mt-1 font-mono text-xs text-[#5C5470]">{code}</p>
      </div>
    </div>
  );
}
