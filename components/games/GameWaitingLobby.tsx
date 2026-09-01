"use client";

import { useState, useEffect } from "react";

interface GameWaitingLobbyProps {
  sessionCode: string;
  gameName: string;
  gameEmoji: string;
  isHost: boolean;
  onCancel: () => void;
  onJoin?: () => void;
  joinLoading?: boolean;
  expiryMinutes?: number;
  timerSeconds?: number | null;
  extraInfo?: React.ReactNode;
}

function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold border transition-all cursor-pointer ${
        copied
          ? "border-[#10B981]/20 bg-[#EBF9EB] text-[#10B981]"
          : "border-[#E7E5E4] bg-white text-[#1F1D1B] hover:border-[#C84B31] hover:text-[#C84B31] shadow-2xs"
      }`}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tersalin!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

/** Pulsing dots animation to show "waiting" state */
function WaitingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[#C84B31]"
          style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export function GameWaitingLobby({
  sessionCode,
  gameName,
  gameEmoji,
  isHost,
  onCancel,
  onJoin,
  joinLoading = false,
  expiryMinutes,
  timerSeconds,
  extraInfo,
}: GameWaitingLobbyProps) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = `${origin}/join/${sessionCode}`;
  const waText = `Yuk main ${gameName} bareng aku di LDR-Connect! ${gameEmoji}\n\nKlik link ini untuk langsung join:\n${joinUrl}\n\nAtau masukkan kode: ${sessionCode}`;

  const timerMM = timerSeconds != null ? String(Math.floor(timerSeconds / 60)).padStart(2, "0") : null;
  const timerSS = timerSeconds != null ? String(timerSeconds % 60).padStart(2, "0") : null;
  const timerUrgent = timerSeconds != null && timerSeconds < 120;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {/* Main card */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 text-center shadow-xl shadow-black/2">
        {/* Game badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-4 py-1.5">
          <span className="text-base">{gameEmoji}</span>
          <span className="text-xs font-semibold text-[#C84B31]">{gameName}</span>
          {extraInfo && (
            <>
              <span className="text-[#A8A29E]">·</span>
              <span className="text-xs text-[#78716C]">{extraInfo}</span>
            </>
          )}
        </div>

        {isHost ? (
          <>
            {/* Host: waiting for partner */}
            <div className="mb-2 flex items-center justify-center gap-3">
              <h2 className="font-serif text-2xl font-bold text-[#1F1D1B]">Menunggu Partner</h2>
              <WaitingDots />
            </div>
            <p className="text-xs text-[#78716C]">
              Bagikan kode atau link di bawah ke pasanganmu agar permainan bisa dimulai.
            </p>

            {/* Session code */}
            <div className="mt-6 rounded-2xl border border-[#E7E5E4] bg-[#FCFBF7] p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#78716C]">
                Kode Sesi Permainan
              </p>
              <p className="font-mono text-3xl font-bold tracking-[0.25em] text-[#C84B31]">
                {sessionCode}
              </p>
            </div>

            {/* Share actions */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <CopyButton text={sessionCode} label="Salin Kode" />
              <CopyButton text={joinUrl} label="Salin Link" />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#10B981]/20 bg-[#EBF9EB] px-3 py-2.5 text-xs font-semibold text-[#10B981] transition hover:bg-[#10B981]/15 shadow-2xs cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M11.99 2C6.477 2 2 6.484 2 12.017c0 1.99.522 3.855 1.442 5.465L2.02 22l4.641-1.404A9.96 9.96 0 0011.99 22C17.515 22 22 17.516 22 12.017 22 6.508 17.515 2 11.99 2zm0 18.044a8.018 8.018 0 01-4.098-1.126l-.294-.175-3.049.922.882-3.045-.192-.313A8.003 8.003 0 013.977 12c0-4.418 3.585-8.017 8.013-8.017 4.419 0 8.014 3.6 8.014 8.017 0 4.419-3.595 8.044-8.014 8.044z" />
                </svg>
                WA
              </a>
            </div>

            {/* Timer */}
            {timerMM !== null && (
              <div className={`mt-5 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 ${
                timerUrgent
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C]"
              }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-semibold">
                  {timerUrgent ? "Sesi akan berakhir: " : "Waktu tersisa: "}
                  <span className="font-mono font-bold">{timerMM}:{timerSS}</span>
                </span>
              </div>
            )}

            {expiryMinutes && !timerMM && (
              <p className="mt-3 text-[11px] text-[#A8A29E]">
                Sesi akan kedaluwarsa otomatis dalam {expiryMinutes} menit jika tidak ada aktivitas.
              </p>
            )}
          </>
        ) : (
          <>
            {/* Partner */}
            <div className="mb-2 flex items-center justify-center gap-3">
              <h2 className="font-serif text-2xl font-bold text-[#1F1D1B]">Kamu Sudah Terhubung!</h2>
            </div>
            <p className="text-xs text-[#78716C]">Menunggu host memulai giliran pertama permainan...</p>

            <div className="mt-6 rounded-2xl border border-[#E7E5E4] bg-[#FCFBF7] p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#78716C]">
                Sesi Aktif
              </p>
              <span className="font-mono text-3xl font-bold tracking-[0.25em] text-[#C84B31]">
                {sessionCode}
              </span>
              {extraInfo && (
                <p className="mt-2 text-xs text-[#78716C]">{extraInfo}</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#10B981]/20 bg-[#EBF9EB] px-4 py-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#10B981]" />
              <span className="text-xs font-semibold text-[#10B981]">Terhubung — Menunggu giliran</span>
            </div>

            {onJoin && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onJoin}
                  disabled={joinLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-5 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {joinLoading ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {joinLoading ? "Memproses..." : "Masuk ke Room"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-xl border border-[#E7E5E4] bg-white px-5 py-2.5 text-xs font-semibold text-[#78716C] shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
      >
        Batalkan Sesi
      </button>
    </div>
  );
}
