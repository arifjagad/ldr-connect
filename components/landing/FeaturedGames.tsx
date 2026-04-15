import Link from "next/link";

const games = [
  {
    id: "tod",
    name: "Truth or Dare",
    desc: "Ungkap rahasia dan hadapi tantangan seru bersama pasangan. Penuh kejutan di setiap giliran.",
    badge: "TERSEDIA",
    available: true,
    cost: "1 Coin / Sesi",
  },
  {
    id: "snake",
    name: "Snake & Ladder Date Night",
    desc: "Versi romantis dari ular tangga klasik — dengan kejutan date ideas di setiap kotak.",
    badge: "SEGERA",
    available: false,
    cost: "Segera hadir",
  },
  {
    id: "quiz",
    name: "Couple Quiz Battle",
    desc: "Seberapa baik kamu mengenal pasanganmu? Jawab pertanyaan dan buktikan.",
    badge: "SEGERA",
    available: false,
    cost: "Segera hadir",
  },
];

export function FeaturedGames() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#FF3D7F08_0%,_transparent_60%)]" />

      <div className="mb-16 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FF3D7F20] bg-[#FF3D7F10] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#FF6B9D]">
            Game Tersedia
          </div>
          <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F5F0FF] lg:text-5xl">
            Satu platform,
            <br />
            banyak cara
            <br />
            <span className="text-[#FF3D7F]">dekat.</span>
          </h2>
        </div>
        <Link
          href="/games"
          className="self-start rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-[#F5F0FF] transition-all duration-200 hover:border-white/40 lg:self-auto"
        >
          Lihat semua game →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {games.map((game) => (
          <div
            key={game.id}
            className={`rounded-2xl border border-[#1C1C21] bg-[#141417] p-6 transition-all duration-300 hover:-translate-y-1 ${
              game.available ? "hover:border-[#FF3D7F30]" : "opacity-60"
            }`}
          >
            <div
              className={`mb-4 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${
                game.available
                  ? "border border-[#FF3D7F20] bg-[#FF3D7F10] text-[#FF6B9D]"
                  : "border border-white/10 bg-white/5 text-[#5C5470]"
              }`}
            >
              {game.badge}
            </div>

            <h3 className="mb-3 text-lg font-semibold text-[#F5F0FF]">{game.name}</h3>
            <p className="mb-6 text-sm leading-relaxed text-[#9B93B0]">{game.desc}</p>

            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold ${game.available ? "text-[#FF6B9D]" : "text-[#5C5470]"}`}
              >
                {game.cost}
              </span>
              {game.available && (
                <Link
                  href="/games"
                  className="text-xs font-semibold text-[#FF6B9D] transition-colors hover:text-[#FF3D7F]"
                >
                  Lihat detail →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
