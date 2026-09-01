"use client";

import type { PendingChallenge } from "@/lib/types";

interface ChallengeModalProps {
  challenge: PendingChallenge;
  myRole: "host" | "partner";
  isConfirming: boolean;
  onConfirm: () => void;
}

export function ChallengeModal({ challenge, myRole, isConfirming, onConfirm }: ChallengeModalProps) {
  const isMyChallengeToComplete = challenge.player === myRole;
  const isTruth = challenge.type === "truth";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md animate-[scale-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="rounded-3xl border border-[#E7E5E4] bg-white p-6 shadow-2xl">
          {/* Badge type */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest border ${
                isTruth
                  ? "bg-[#EEF2FF] text-[#4F46E5] border-[#E0E7FF]"
                  : "bg-[#FDF4F2] text-[#C84B31] border-[#FBDCD5]"
              }`}
            >
              {isTruth ? "✦ Truth" : "⚡ Dare"}
            </span>
            <span className="rounded-full bg-[#FCFBF7] border border-[#E7E5E4] px-2.5 py-1 text-[10px] font-semibold text-[#78716C]">
              {challenge.category}
            </span>
          </div>

          {/* Kotak pertanyaan */}
          <div
            className={`rounded-2xl border p-5 mb-5 text-center ${
              isTruth
                ? "bg-[#EEF2FF]/40 border-[#E0E7FF]"
                : "bg-[#FDF4F2]/50 border-[#FBDCD5]"
            }`}
          >
            <p className="font-serif text-lg font-bold leading-relaxed text-[#1F1D1B]">
              {challenge.question}
            </p>
          </div>

          {/* Status */}
          {isMyChallengeToComplete ? (
            <div className="text-center space-y-3">
              <p className="text-sm font-bold text-[#1F1D1B]">Ini tantanganmu!</p>
              <p className="text-xs text-[#78716C]">
                {isTruth
                  ? "Jawab pertanyaan ini dengan jujur kepada pasanganmu."
                  : "Lakukan tantangan ini dan tunjukkan kepada pasanganmu."}
              </p>
              {challenge.roll_again && (
                <p className="text-xs font-semibold text-[#D97706]">
                  ★ Kamu mendapat angka 6 — setelah tantangan selesai, kamu boleh lempar dadu lagi!
                </p>
              )}
              <div className="flex items-center justify-center gap-2 mt-2 text-xs text-[#78716C]">
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
                Menunggu pasanganmu mengkonfirmasi...
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm font-bold text-[#1F1D1B]">Tantangan pasanganmu!</p>
              <p className="text-xs text-[#78716C]">
                Pastikan pasanganmu sudah {isTruth ? "menjawab pertanyaan" : "menyelesaikan tantangan"} dengan benar.
              </p>
              {challenge.roll_again && (
                <p className="text-xs font-semibold text-[#D97706]">
                  ★ Pasanganmu dapat angka 6 — setelah ini dia boleh lempar dadu lagi!
                </p>
              )}
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-5 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:opacity-60 cursor-pointer"
              >
                {isConfirming ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Mengkonfirmasi...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Konfirmasi Selesai
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
