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
      <div className="flex min-h-screen items-center justify-center bg-[#FCFBF7] px-4">
        <div className="max-w-sm w-full rounded-2xl border border-[#E7E5E4] bg-white p-6 text-center shadow-xl shadow-black/2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FEF2F2] border border-red-200">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-base font-serif font-bold text-[#1F1D1B]">Sesi Tidak Ditemukan</p>
          <p className="mt-2 text-xs leading-relaxed text-[#78716C]">{error}</p>
          <button
            onClick={() => router.replace("/dashboard/games")}
            className="mt-6 w-full rounded-xl bg-[#C84B31] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] cursor-pointer"
          >
            Ke Halaman Games
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FCFBF7] px-4">
      <div className="max-w-sm w-full rounded-2xl border border-[#E7E5E4] bg-white p-6 text-center shadow-xl shadow-black/2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FDF4F2] border border-[#FBDCD5]">
          <span className="text-3xl">🎮</span>
        </div>
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">Mengarahkan ke game…</p>
        <p className="mt-1 font-mono text-xs text-[#78716C]">{code}</p>
      </div>
    </div>
  );
}
