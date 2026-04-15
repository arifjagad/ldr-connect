const steps = [
  {
    number: "01",
    title: "Daftar & Link Pasangan",
    desc: "Buat akun, lalu bagikan couple code ke pasanganmu untuk terhubung.",
  },
  {
    number: "02",
    title: "Beli Coin",
    desc: "Isi saldo coin sesuai kebutuhan. Bayar hanya saat mau main — tanpa langganan.",
  },
  {
    number: "03",
    title: "Pilih Game & Main",
    desc: "Pilih game favoritmu, buat sesi, dan nikmati quality time bersama walau jauh.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
      <div className="mb-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FF3D7F20] bg-[#FF3D7F10] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#FF6B9D]">
          Cara Kerja
        </div>
        <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F5F0FF] lg:text-5xl">
          Mulai bermain
          <br />
          dalam 3 langkah.
        </h2>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.number}
            className="relative overflow-hidden rounded-2xl border border-[#1C1C21] border-l-2 border-l-[#FF3D7F] bg-[#141417] p-6"
          >
            <p className="pointer-events-none absolute -top-4 left-4 select-none text-8xl font-black leading-none text-[#FF3D7F]/10">
              {step.number}
            </p>
            <div className="relative">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5C5470]">
                {step.number}
              </p>
              <h3 className="mb-2 text-lg font-semibold text-[#F5F0FF]">{step.title}</h3>
              <p className="text-sm leading-relaxed text-[#9B93B0]">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
