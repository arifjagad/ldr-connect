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
  const isPartnerChallenge = !isMyChallengeToComplete;

  const isTruth = challenge.type === "truth";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md animate-[scale-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div
          className="rounded-3xl border p-6"
          style={{
            background: isTruth
              ? "linear-gradient(135deg, #1a1035 0%, #0f0f1a 100%)"
              : "linear-gradient(135deg, #1a0a18 0%, #0f0f1a 100%)",
            borderColor: isTruth ? "rgba(129,140,248,0.3)" : "rgba(255,61,127,0.3)",
          }}
        >
          {/* Badge type */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span
              className="rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
              style={{
                background: isTruth ? "rgba(129,140,248,0.15)" : "rgba(255,61,127,0.15)",
                color: isTruth ? "#818CF8" : "#FF6B9D",
                border: `1px solid ${isTruth ? "rgba(129,140,248,0.3)" : "rgba(255,61,127,0.3)"}`,
              }}
            >
              {isTruth ? "✦ Truth" : "⚡ Dare"}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[#5C5470]">
              {challenge.category}
            </span>
          </div>

          {/* Kotak pertanyaan */}
          <div
            className="rounded-2xl border p-5 mb-5 text-center"
            style={{
              background: isTruth ? "rgba(129,140,248,0.05)" : "rgba(255,61,127,0.05)",
              borderColor: isTruth ? "rgba(129,140,248,0.15)" : "rgba(255,61,127,0.1)",
            }}
          >
            <p className="text-base font-medium leading-relaxed text-[#FFF5F8]">
              {challenge.question}
            </p>
          </div>

          {/* Status */}
          {isMyChallengeToComplete ? (
            <div className="text-center space-y-3">
              <p className="text-sm font-semibold text-[#FFF5F8]">Ini tantanganmu!</p>
              <p className="text-xs text-[#9B93B0]">
                {isTruth
                  ? "Jawab pertanyaan ini dengan jujur kepada pasanganmu."
                  : "Lakukan tantangan ini dan tunjukkan kepada pasanganmu."}
              </p>
              {challenge.roll_again && (
                <p className="text-xs font-medium text-yellow-400">
                  ★ Kamu mendapat angka 6 — setelah tantangan selesai, kamu boleh lempar dadu lagi!
                </p>
              )}
              <div className="flex items-center justify-center gap-2 mt-2 text-xs text-[#5C5470]">
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
                Menunggu pasanganmu mengkonfirmasi...
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm font-semibold text-[#FFF5F8]">Tantangan pasanganmu!</p>
              <p className="text-xs text-[#9B93B0]">
                Pastikan pasanganmu sudah {isTruth ? "menjawab pertanyaan" : "menyelesaikan tantangan"} dengan benar.
              </p>
              {challenge.roll_again && (
                <p className="text-xs font-medium text-yellow-400">
                  ★ Pasanganmu dapat angka 6 — setelah ini dia boleh lempar dadu lagi!
                </p>
              )}
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white transition"
                style={{
                  background: isTruth
                    ? "linear-gradient(90deg, #818CF8, #A78BFA)"
                    : "linear-gradient(90deg, #FF3D7F, #FF6B9D)",
                  boxShadow: isTruth
                    ? "0 4px 20px rgba(129,140,248,0.35)"
                    : "0 4px 20px rgba(255,61,127,0.35)",
                  opacity: isConfirming ? 0.7 : 1,
                }}
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
