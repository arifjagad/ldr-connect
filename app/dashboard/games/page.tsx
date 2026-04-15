import Link from "next/link";

const games = [
  {
    href: "/dashboard/games/tod",
    status: "available",
    statusLabel: "Available Now",
    title: "Truth or Dare",
    description:
      "Pertanyaan romantis + tantangan seru untuk bikin ngobrol kalian makin dalam dan makin dekat.",
    gradient: "from-[#FF3D7F]/20 via-[#FF6B9D]/10 to-transparent",
    border: "border-[#FF3D7F]/25 hover:border-[#FF3D7F]/60",
    glow: "rgba(255,61,127,0.15)",
    badge: "bg-[#FF3D7F]/15 text-[#FF6B9D] border-[#FF3D7F]/25",
    dot: "bg-[#FF3D7F] shadow-[0_0_8px_#FF3D7F]",
    cta: "Mulai Game",
    ctaStyle:
      "bg-[#FF3D7F] hover:bg-[#FF6B9D] text-white shadow-[0_4px_20px_rgba(255,61,127,0.35)]",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF6B9D" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    tags: ["Romantis", "2 Pemain", "Realtime"],
  },
  {
    href: "/dashboard/games/snake",
    status: "available",
    statusLabel: "Available Now",
    title: "Snake & Ladder",
    description:
      "Board klasik 10×10 dengan Truth or Dare di tiap kotak tantangan. Lempar dadu, kena ular turun, naik tangga melompat!",
    gradient: "from-[#818CF8]/20 via-[#A78BFA]/10 to-transparent",
    border: "border-[#818CF8]/25 hover:border-[#818CF8]/60",
    glow: "rgba(129,140,248,0.15)",
    badge: "bg-[#818CF8]/15 text-[#818CF8] border-[#818CF8]/25",
    dot: "bg-[#818CF8] shadow-[0_0_8px_#818CF8]",
    cta: "Mulai Game",
    ctaStyle: "bg-[#818CF8] hover:bg-[#A78BFA] text-white shadow-[0_4px_20px_rgba(129,140,248,0.35)]",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1.5" fill="#818CF8" />
        <circle cx="16" cy="8" r="1.5" fill="#818CF8" />
        <circle cx="8" cy="16" r="1.5" fill="#818CF8" />
        <circle cx="16" cy="16" r="1.5" fill="#818CF8" />
        <circle cx="12" cy="12" r="1.5" fill="#818CF8" />
      </svg>
    ),
    tags: ["Board Game", "2 Pemain", "Strategi"],
  },
  {
    href: "#",
    status: "soon",
    statusLabel: "Coming Soon",
    title: "Couple Quiz",
    description:
      "Seberapa kenal kamu sama pasangan? Fun facts, deep questions, dan kejutan menarik menanti.",
    gradient: "from-[#F472B6]/10 via-[#E879F9]/5 to-transparent",
    border: "border-[#F472B6]/15",
    glow: "rgba(244,114,182,0.08)",
    badge: "bg-[#F472B6]/10 text-[#F472B6] border-[#F472B6]/20",
    dot: "bg-[#5C5470]",
    cta: "Coming Soon",
    ctaStyle: "bg-white/5 text-[#5C5470] cursor-not-allowed",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
        <circle cx="12" cy="17" r="0.5" fill="#F472B6" />
      </svg>
    ),
    tags: ["Quiz", "2 Pemain", "Seru"],
  },
];

export default function GamesHubPage() {
  return (
    <main className="relative mx-auto w-full max-w-6xl px-6 py-12 lg:px-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-100 w-150 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(255,61,127,0.10) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-12">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
          Games Menu
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Pilih{" "}
          <span
            style={{
              backgroundImage: "linear-gradient(90deg, #FF6B9D, #FF3D7F)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Game Night
          </span>{" "}
          Kalian
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#5C5470]">
          Pilih game, buat session, dan main bareng partner. Semua dirancang untuk mempererat hubungan kalian.
        </p>
      </div>

      {/* Game Cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        {games.map((game) => (
          <div
            key={game.title}
            className={`group relative overflow-hidden rounded-3xl border bg-linear-to-br ${game.gradient} ${game.border} p-6 transition-all duration-300 ${game.status === "available" ? "hover:scale-[1.02] hover:shadow-2xl" : "opacity-70"}`}
            style={
              game.status === "available"
                ? { boxShadow: `0 0 0 0 ${game.glow}` }
                : undefined
            }
          >
            {/* Background glow orb */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl transition-opacity"
              style={{ background: game.glow }}
            />

            {/* Top row: icon + badge */}
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                {game.icon}
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${game.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${game.dot}`} />
                {game.statusLabel}
              </span>
            </div>

            {/* Content */}
            <div className="mt-5">
              <h2 className="text-2xl font-bold text-[#FFF5F8]">{game.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#9B93B0]">{game.description}</p>
            </div>

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              {game.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-[#5C5470]"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-6">
              {game.status === "available" ? (
                <Link
                  href={game.href}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${game.ctaStyle}`}
                >
                  {game.cta}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : (
                <span className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${game.ctaStyle}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
                  </svg>
                  {game.cta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom links */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard/games/history"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-[#9B93B0] transition hover:border-white/20 hover:bg-white/10 hover:text-[#FFF5F8]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          Riwayat Game
        </Link>
        <Link
          href="/dashboard/games/tod/questions"
          className="flex items-center gap-2 rounded-xl border border-[#FF3D7F]/20 bg-[#FF3D7F]/5 px-5 py-2.5 text-sm font-medium text-[#FF6B9D] transition hover:border-[#FF3D7F]/40 hover:bg-[#FF3D7F]/10"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          Pertanyaan Kustom ToD
        </Link>
      </div>
      <p className="mt-4 text-center text-xs text-[#5C5470]">
        Game baru akan terus ditambahkan. Stay tuned!
      </p>
    </main>
  );
}
