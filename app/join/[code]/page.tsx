"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

const GAME_ROUTES: Record<string, string> = {
  tod:          "/dashboard/games/tod",
  snake_ladder: "/dashboard/games/snake-ladder",
  quiz:         "/dashboard/games/quiz",
  dare_derby:   "/dashboard/games/dare-derby",
  quoridor:     "/dashboard/games/quoridor",
};

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string ?? "").toUpperCase();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      router.replace("/dashboard/games");
      return;
    }

    async function checkAndRedirect() {
      const res = await fetch(`/api/game/session/${code}`);

      if (res.status === 401) {
        router.replace(`/auth/login?redirect=/join/${code}`);
        return;
      }

      if (!res.ok) {
        setError("Link tidak valid atau sesi sudah berakhir. Minta kode baru dari pasanganmu.");
        return;
      }

      const data = await res.json();
      const gameType: string | undefined = data?.data?.game_type;
      const gamePath = gameType ? (GAME_ROUTES[gameType] ?? null) : null;

      if (!gamePath) {
        setError("Jenis game tidak dikenali. Minta kode baru dari pasanganmu.");
        return;
      }

      router.replace(`${gamePath}?join=${code}`);
    }

    checkAndRedirect();
  }, [code, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-base font-semibold text-white">Sesi Tidak Ditemukan</p>
          <p className="mt-2 text-sm text-[#9B93B0]">{error}</p>
          <button
            onClick={() => router.replace("/dashboard/games")}
            className="mt-6 rounded-xl bg-[#818CF8] px-6 py-2.5 text-sm font-medium text-white"
          >
            Ke Halaman Games
          </button>
        </div>
      </div>
    );
  }

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
