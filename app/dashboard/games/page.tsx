"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const GAME_ROUTES: Record<string, string> = {
  tod:          "/dashboard/games/tod",
  snake_ladder: "/dashboard/games/snake-ladder",
  quiz:         "/dashboard/games/quiz",
  dare_derby:   "/dashboard/games/dare-derby",
  quoridor:     "/dashboard/games/quoridor",
};

const games = [
  {
    href: "/dashboard/games/tod",
    statusLabel: "Tersedia",
    title: "Truth or Dare",
    description: "Pertanyaan romantis dan tantangan seru untuk bikin ngobrol kalian makin dalam dan makin dekat.",
    badge: "bg-[#FDF4F2] text-[#C84B31] border-[#FBDCD5]",
    dot: "bg-[#C84B31]",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    tags: ["Romantis", "2 Pemain", "Realtime"],
  },
  {
    href: "/dashboard/games/snake-ladder",
    statusLabel: "Tersedia",
    title: "Snake & Ladder",
    description: "Papan 10×10 dengan Truth or Dare di tiap kotak tantangan. Lempar dadu, kena ular turun, naik tangga!",
    badge: "bg-[#EEF2FF] text-[#4F46E5] border-[#E0E7FF]",
    dot: "bg-[#4F46E5]",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="16" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="16" r="1.5" fill="currentColor" />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    tags: ["Board Game", "2 Pemain", "Strategi"],
  },
  {
    href: "/dashboard/games/dare-derby",
    statusLabel: "Tersedia",
    title: "Dare Derby",
    description: "Mini-game kompetitif! Keduanya main game yang sama — yang kalah tiap ronde dapat dare nyata dari pasangan.",
    badge: "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]",
    dot: "bg-[#D97706]",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    tags: ["Mini-game", "2 Pemain", "Kompetitif"],
  },
  {
    href: "/dashboard/games/quoridor",
    statusLabel: "Tersedia",
    title: "Quoridor",
    description: "Game strategi papan 9×9. Gerakkan pion atau pasang balok dinding — yang pertama mencapai garis lawan menang!",
    badge: "bg-[#EBF9EB] text-[#10B981] border-[#10B981]/20",
    dot: "bg-[#10B981]",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        <path d="M8 12h8M12 8v8" strokeLinecap="round" strokeOpacity="0.4" />
      </svg>
    ),
    tags: ["Strategi", "2 Pemain", "Turn-based"],
  },
];

// ── Join redirect handler ────────────────────────────────────────────────────
function JoinRedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinCode = searchParams?.get("join")?.toUpperCase() ?? "";

  useEffect(() => {
    if (!joinCode) return;

    async function handleJoinRedirect() {
      try {
        const res = await fetch(`/api/game/session/${joinCode}`);
        if (res.status === 401) {
          router.replace(`/auth/login?redirect=/dashboard/games?join=${joinCode}`);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const gameType: string | undefined = data?.data?.game_type;
        const gamePath = gameType ? (GAME_ROUTES[gameType] ?? null) : null;
        if (gamePath) {
          router.replace(`${gamePath}?join=${joinCode}`);
        }
      } catch {}
    }

    handleJoinRedirect();
  }, [joinCode, router]);

  if (joinCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
            <span className="text-2xl">🎮</span>
          </div>
          <p className="font-serif text-lg font-bold text-[#1F1D1B]">Mengarahkan ke Game Room…</p>
          <p className="mt-1 font-mono text-xs font-bold text-[#C84B31]">{joinCode}</p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Games Hub Page ───────────────────────────────────────────────────────────
function GamesHubContent() {
  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          <span>🎮</span>
          <span>Game Night Hub</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
          Pilih Game Pasangan
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#78716C] max-w-xl">
          Pilih permainan, buat room atau masukkan kode sesi, dan mainkan langsung bersama pasanganmu secara realtime.
        </p>
      </div>

      {/* Game Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((game) => (
          <div
            key={game.title}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2 transition-all duration-200 hover:border-[#C84B31] hover:-translate-y-1 cursor-pointer"
          >
            <div>
              {/* Top row: icon + badge */}
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] text-[#1F1D1B]">
                  {game.icon}
                </div>
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${game.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${game.dot}`} />
                  {game.statusLabel}
                </span>
              </div>

              {/* Content */}
              <div className="mt-5">
                <h2 className="font-serif text-xl font-bold text-[#1F1D1B] group-hover:text-[#C84B31] transition-colors">{game.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-[#78716C]">{game.description}</p>

                {/* Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {game.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#E7E5E4] bg-[#FCFBF7] px-2.5 py-0.5 text-[10px] font-semibold text-[#78716C]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-6 pt-5 border-t border-[#F5F5F4]">
              <Link
                href={game.href}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#B33E26]"
              >
                Mulai Main
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom utility links */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard/games/history"
          className="flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-semibold text-[#1F1D1B] shadow-2xs transition hover:border-[#C84B31] hover:text-[#C84B31]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          Riwayat Permainan
        </Link>
        <Link
          href="/dashboard/games/stats"
          className="flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-semibold text-[#1F1D1B] shadow-2xs transition hover:border-[#C84B31] hover:text-[#C84B31]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Statistik &amp; Leaderboard
        </Link>
        <Link
          href="/dashboard/games/tod/questions"
          className="flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-semibold text-[#1F1D1B] shadow-2xs transition hover:border-[#C84B31] hover:text-[#C84B31]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          Pertanyaan Kustom ToD
        </Link>
      </div>
    </main>
  );
}

export default function GamesHubPage() {
  return (
    <>
      <Suspense>
        <JoinRedirectHandler />
      </Suspense>
      <GamesHubContent />
    </>
  );
}
