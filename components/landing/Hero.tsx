"use client";

import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#FCFBF7] pt-12 pb-16 lg:pt-16 lg:pb-24">
      <div className="mx-auto w-full max-w-4xl px-6 text-center">
        {/* Subtitle tag */}
        <div className="inline-flex items-center">
          <span className="text-[11px] font-semibold tracking-wider text-[#C84B31] uppercase">
            Main Bareng, Walau Beda Kota
          </span>
        </div>

        {/* Big Editorial Headline */}
        <h1 className="font-editorial mt-4 text-4xl leading-[1.18] font-normal tracking-tight text-[#1F1D1B] sm:text-6xl lg:text-[4rem]">
          Mendekatkan yang jauh dengan <br />
          tawa dan rahasia.
        </h1>

        {/* Description */}
        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-[#78716C] sm:text-base">
          Platform romantis khusus pasangan LDR untuk bermain mini-games interaktif,
          berbagi kejujuran, dan menciptakan memori bermakna secara real-time.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/auth/register"
            className="rounded-full bg-[#C84B31] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#B33E26]"
          >
            Mulai Gratis
          </Link>
          <Link
            href="/#games"
            className="rounded-full border border-[#E7E5E4] bg-white px-5 py-2.5 text-xs font-semibold text-[#1F1D1B] shadow-xs transition-all hover:bg-[#F5F5F4]"
          >
            Lihat Games
          </Link>
        </div>

        {/* Live Game Mockup Card */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl sm:p-8">
          {/* Card Topbar */}
          <div className="flex items-center justify-between border-b border-[#F5F5F4] pb-4">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C84B31] text-[9px] font-bold text-white">
                  R
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1F1D1B] text-[9px] font-bold text-white">
                  D
                </div>
              </div>
              <span className="text-xs font-semibold text-[#1F1D1B]">
                Rina & Dimas (Jakarta — Bandung)
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Terhubung Real-time</span>
            </div>
          </div>

          {/* Card Main Body */}
          <div className="grid gap-6 pt-8 pb-4 md:grid-cols-[1.6fr_1fr]">
            {/* Left: Truth Question */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#F5F5F4] bg-[#FCFBF7] p-8 text-center">
              <span className="text-[10px] font-bold tracking-widest text-[#C84B31] uppercase">
                Pertanyaan Ke-12 (Truth)
              </span>
              <p className="font-editorial mt-4 text-xl font-normal leading-snug text-[#1F1D1B] sm:text-2xl">
                &ldquo;Kapan momen pertama kali kamu sadar kalau aku adalah orang yang tepat buat kamu?&rdquo;
              </p>
              <div className="mt-6 inline-flex items-center rounded-full bg-white px-4 py-1 text-xs text-[#78716C] shadow-xs">
                <span>Rina sedang mengetik...</span>
              </div>
            </div>

            {/* Right: Live Reaction Activity */}
            <div className="flex flex-col justify-between rounded-xl border border-[#F5F5F4] bg-white p-5 text-left">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-[#78716C] uppercase">
                  Live Reaction
                </span>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-[#FCFBF7] p-3 text-xs">
                    <p className="font-medium text-[#1F1D1B]">
                      Aaa pertanyaannya bikin baper! ❤️
                    </p>
                    <span className="mt-1 block text-[10px] text-[#A8A29E]">Rina • Baru saja</span>
                  </div>
                  <div className="rounded-lg bg-[#FCFBF7] p-3 text-xs">
                    <p className="font-medium text-[#1F1D1B]">
                      Hahaha jawab dong jujur!
                    </p>
                    <span className="mt-1 block text-[10px] text-[#A8A29E]">Dimas • Baru saja</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#F5F5F4] pt-3 text-[11px] text-[#78716C]">
                <span>Status Jawaban:</span>
                <span className="font-semibold text-emerald-600">Sync 100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
