const testimonials = [
  {
    quote:
      "Aku dan Dimas udah LDR 2 tahun. ToD bikin malem minggu kita gak pernah bosen lagi. Pertanyaan AI-nya kadang lebih dalam dari yang kita bayangkan 😭",
    name: "Rina & Dimas",
    location: "Jakarta ↔ Surabaya",
    initials: ["R", "D"],
  },
  {
    quote:
      "Awalnya skeptis, tapi setelah nyoba satu sesi langsung nagih. Dare-nya malah jadi momen sweet yang gak terduga. Coin-nya worth banget!",
    name: "Bela & Arif",
    location: "Bandung ↔ Medan",
    initials: ["B", "A"],
  },
  {
    quote:
      "Game ini beneran ngubah cara kita komunikasi. Setiap giliran selalu bikin penasaran. Gak nyangka platform LDR bisa se-fun ini.",
    name: "Dita & Reza",
    location: "Yogyakarta ↔ Kalimantan",
    initials: ["D", "R"],
  },
];

export function Testimonials() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8">
      <div className="mb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B9D]">
          ✦ Kata Mereka
        </p>
        <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-[#FFF5F8] lg:text-5xl">
          Pasangan nyata,
          <br />
          momen <span className="text-[#FF3D7F]">nyata.</span>
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl border border-[#FF3D7F15] bg-[#111113] p-6 transition-all duration-300 hover:border-[#FF3D7F35]"
          >
            {/* Quote mark */}
            <div className="mb-4 text-4xl font-black leading-none text-[#FF3D7F] opacity-60">"</div>

            <p className="flex-1 text-sm leading-relaxed text-[#9B93B0]">{t.quote}</p>

            <div className="mt-6 flex items-center gap-3 border-t border-white/5 pt-5">
              <div className="flex -space-x-2">
                {t.initials.map((l, j) => (
                  <div
                    key={j}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#111113] text-xs font-black text-white"
                    style={{ background: j === 0 ? "#FF3D7F" : "#c026a0" }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-bold text-[#FFF5F8]">{t.name}</p>
                <p className="text-xs text-[#5C5470]">{t.location}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
