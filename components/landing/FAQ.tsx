"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Apa itu LDR-Connect?",
    a: "LDR-Connect adalah platform interaktif yang dibuat khusus untuk membantu pasangan jarak jauh menjaga kehangatan hubungan melalui mini-games real-time dan generator pertanyaan berbasis AI.",
  },
  {
    q: "Bagaimana sistem koin bekerja?",
    a: "Setiap sesi game membutuhkan koin (biasanya 1 atau 2 koin per sesi). Kalian mendapatkan 5 koin gratis setiap hari hanya dengan login, dan bisa melakukan top-up dengan harga sangat terjangkau jika ingin kencan maraton.",
  },
  {
    q: "Apakah pasangan saya juga harus memiliki akun?",
    a: "Ya. Kalian berdua perlu mendaftar dan saling menautkan akun menggunakan kode unik privat agar game kalian tersinkronisasi secara real-time.",
  },
  {
    q: "Apakah obrolan dan data kami aman?",
    a: "Keamanan privasi kalian adalah prioritas kami. Semua chat, jawaban kuis, dan data penghubung akun sepenuhnya dienkripsi dan tidak akan pernah dibagikan ke pihak ketiga.",
  },
  {
    q: "Bisakah kami bermain sambil melakukan panggilan video?",
    a: "Tentu saja! Platform kami dirancang untuk mendukung multitasking sehingga kalian bisa membuka LDR-Connect berdampingan dengan aplikasi video call favorit kalian.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="border-t border-[#E7E5E4] bg-[#FCFBF7] py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          {/* Left Title */}
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-[#C84B31] uppercase">
              Pertanyaan Umum
            </span>
            <h2 className="font-editorial mt-3 text-3xl font-normal leading-snug tracking-tight text-[#1F1D1B] sm:text-4xl">
              Masih ada <br />
              pertanyaan? Ini <br />
              jawabannya.
            </h2>
            <p className="mt-4 text-xs leading-relaxed text-[#78716C]">
              Kami merangkum semua yang perlu kalian ketahui tentang keamanan, koin, dan cara terbaik memulai kencan LDR yang berkesan.
            </p>
          </div>

          {/* Right Accordion */}
          <div className="divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
            {faqs.map((faq, idx) => {
              const isOpen = open === idx;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between text-left transition-colors"
                  >
                    <span className="text-sm font-semibold text-[#1F1D1B]">
                      {faq.q}
                    </span>
                    <span className="ml-4 text-base font-light text-[#78716C]">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-3 pr-6 text-xs leading-relaxed text-[#78716C]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
