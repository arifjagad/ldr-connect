export function Testimonials() {
  const reviews = [
    {
      quote:
        "Aku dan Dimas udah LDR 2 tahun. Tapi main Truth or Dare di sini bikin malam minggu kita gak pernah bosan. Pertanyaannya selalu tak terduga!",
      author: "Rina & Dimas",
      location: "Jakarta — Bandung",
      initials: "RD",
      badgeColor: "bg-[#C84B31]",
    },
    {
      quote:
        "Awalnya skeptis, tapi setelah nyoba main Snake & Ladder seminggu sekali, obrolan kami jadi jauh lebih seru. Gak ada lagi momen hening canggung.",
      author: "Bella & Hendra",
      location: "Surabaya — Medan",
      initials: "BH",
      badgeColor: "bg-[#D97706]",
    },
    {
      quote:
        "Fitur video call terintegrasi plus game Dare Derby beneran ngebantu komunikasi kami. Terasa beneran kencan meskipun beda pulau.",
      author: "Dita & Reza",
      location: "Yogyakarta — Denpasar",
      initials: "DR",
      badgeColor: "bg-[#2563EB]",
    },
  ];

  return (
    <section className="bg-[#FCFBF7] py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-6 text-center">
        <span className="text-[10px] font-semibold tracking-wider text-[#C84B31] uppercase">
          Kata Mereka
        </span>
        <h2 className="font-editorial mt-3 text-3xl font-normal tracking-tight text-[#1F1D1B] sm:text-4xl">
          Pasangan nyata, momen nyata.
        </h2>

        <div className="mt-12 grid gap-6 text-left md:grid-cols-3">
          {reviews.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xs transition-all duration-200 hover:border-[#D6D3D1] hover:shadow-md"
            >
              <div>
                <span className="font-editorial text-2xl font-bold text-[#C84B31]">
                  &ldquo;&rdquo;
                </span>
                <p className="mt-2 text-xs leading-relaxed text-[#78716C]">
                  {item.quote}
                </p>
              </div>

              <div className="mt-8 flex items-center gap-3 border-t border-[#F5F5F4] pt-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${item.badgeColor}`}>
                  {item.initials}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1F1D1B]">{item.author}</div>
                  <div className="text-[10px] text-[#A8A29E]">{item.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
