import Link from "next/link";
import { Footer } from "@/components/landing/Footer";

const games = [
  {
    id: "tod",
    name: "Truth or Dare",
    tagline: "Jujur atau terima tantangan",
    desc: "Ungkap rahasia tersembunyi atau hadapi tantangan seru bersama pasangan. Setiap giliran membawa kejutan baru yang mempererat hubungan kalian.",
    badge: "TERSEDIA",
    available: true,
    cost: "1 Coin / Sesi",
    features: [
      "Pertanyaan dari admin & AI",
      "Tambah pertanyaan sendiri",
      "Sesi real-time bersama pasangan",
      "Berbagai kategori tersedia",
    ],
    href: "/dashboard/games/tod",
  },
  {
    id: "snake",
    name: "Snake & Ladder Date Night",
    tagline: "Ular tangga edisi romantis",
    desc: "Versi romantis dari ular tangga klasik dengan kejutan date ideas, tantangan mini, dan momen manis di setiap kotak.",
    badge: "SEGERA",
    available: false,
    cost: "Segera hadir",
    features: [
      "Date idea di setiap kotak",
      "Tantangan mini interaktif",
      "Papan digital yang seru",
      "Mode kompetitif",
    ],
    href: "#",
  },
  {
    id: "derby",
    name: "Dare Derby",
    tagline: "Mini-game kompetitif",
    desc: "Kalian main game yang sama secara bersamaan — yang kalah di tiap ronde dapat dare nyata yang harus dilakukan sekarang juga!",
    badge: "TERSEDIA",
    available: true,
    cost: "Mulai 3 Coin / Sesi",
    features: [
      "Mini-game real-time",
      "Dare interaktif (live)",
      "Banyak pilihan dare level",
      "Kompetitif tapi romantis",
    ],
    href: "/dashboard/games/dare-derby",
  },
];

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-[#FCFBF7]">
      <div className="relative mx-auto w-full max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        {/* Header */}
        <div className="relative mb-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FBDCD5] bg-[#FDF4F2] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#C84B31]">
            Semua Game
          </div>
          <h1 className="text-5xl font-serif font-bold leading-[1.1] tracking-tight text-[#1F1D1B] lg:text-7xl">
            Pilih game
            <br />
            <span className="text-[#C84B31]">favoritmu.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[#78716C]">
            Semua game dirancang khusus untuk pasangan — asyik dimainkan kapanpun dan dimanapun
            kalian berada.
          </p>
        </div>

        {/* Games grid */}
        <div className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <div
              key={game.id}
              className={`flex flex-col rounded-2xl border border-[#E7E5E4] bg-white p-6 transition-all duration-300 shadow-xl shadow-black/2 ${
                game.available ? "hover:-translate-y-1 hover:border-[#C84B31]/30 hover:shadow-2xl hover:shadow-black/5" : "opacity-60"
              }`}
            >
              <div
                className={`mb-5 self-start rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${
                  game.available
                    ? "border border-[#FBDCD5] bg-[#FDF4F2] text-[#C84B31]"
                    : "border border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C]"
                }`}
              >
                {game.badge}
              </div>

              <h2 className="mb-1 text-xl font-serif font-bold text-[#1F1D1B]">{game.name}</h2>
              <p className="mb-4 text-sm font-semibold text-[#C84B31]">{game.tagline}</p>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-[#78716C]">{game.desc}</p>

              <ul className="mb-6 space-y-2">
                {game.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[#78716C]">
                    <span
                      className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                        game.available ? "bg-[#C84B31]" : "bg-[#A8A29E]"
                      }`}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t border-[#E7E5E4] pt-4">
                <span
                  className={`text-sm font-bold ${
                    game.available ? "text-[#C84B31]" : "text-[#78716C]"
                  }`}
                >
                  {game.cost}
                </span>
                {game.available ? (
                  <Link
                    href={game.href}
                    className="rounded-full bg-[#C84B31] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[#B33E26] cursor-pointer shadow-xs"
                  >
                    Main sekarang
                  </Link>
                ) : (
                  <span className="rounded-full border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2 text-xs font-semibold text-[#78716C]">
                    Coming soon
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
