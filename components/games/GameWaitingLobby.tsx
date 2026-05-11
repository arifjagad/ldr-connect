"use client";

import { useState } from "react";

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

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#9B93B0] transition hover:border-[#FF3D7F]/40 hover:bg-[#FF3D7F]/10 hover:text-[#FF6B9D]"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label}
        </>
      )}
    </button>
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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const waText = `Yuk main ${gameName} bareng aku di LDR-Connect! ${gameEmoji}\n\nKlik link ini untuk langsung join:\n${origin}/join/${sessionCode}\n\nAtau masukkan kode: ${sessionCode}`;

  const timerMM = timerSeconds !== null && timerSeconds !== undefined
    ? String(Math.floor(timerSeconds / 60)).padStart(2, "0")
    : null;
  const timerSS = timerSeconds !== null && timerSeconds !== undefined
    ? String(timerSeconds % 60).padStart(2, "0")
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#111113] p-6 sm:p-8 text-center text-[#FFF5F8]">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5C5470]/20">
          {isHost ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9B93B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ) : (
            <span className="text-3xl">{gameEmoji}</span>
          )}
        </div>

        {isHost ? (
          <>
            <h2 className="text-xl font-bold text-[#FFF5F8]">Menunggu Partner…</h2>
            <p className="mt-1 text-sm text-[#5C5470]">Bagikan session code ke pasanganmu</p>

            {/* Session code card */}
            <div className="mt-6 flex w-full max-w-sm flex-col items-center rounded-xl border border-white/5 bg-[#18181C] p-6">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Session Code</span>
              <span className="mt-2 font-mono text-2xl font-bold tracking-widest text-[#818CF8]">
                {sessionCode}
              </span>
              {extraInfo && (
                <p className="mt-2 text-xs text-[#5C5470]">{extraInfo}</p>
              )}
              <div className="mt-4 flex gap-2">
                <CopyButton text={sessionCode} label="Salin Code" />
              </div>
            </div>

            {/* Timer (optional) */}
            {timerMM !== null && (
              <p className="mt-4 text-sm text-[#9B93B0]">
                Sisa waktu tunggu:{" "}
                <span className="font-mono font-semibold text-[#FFF5F8]">
                  {timerMM}:{timerSS}
                </span>
              </p>
            )}

            {/* WhatsApp share */}
            <div className="mt-4 w-full max-w-sm">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366]/10 px-5 py-2.5 text-sm font-semibold text-[#25D366] ring-1 ring-[#25D366]/30 transition hover:bg-[#25D366]/20"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Kirim via WhatsApp
              </a>
            </div>

            {expiryMinutes && (
              <p className="mt-4 text-xs text-[#5C5470]">
                Sesi akan otomatis expired dalam {expiryMinutes} menit jika partner tidak bergabung.
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[#FFF5F8]">Pasanganmu Memanggil!</h2>
            <p className="mt-1 text-sm text-[#5C5470]">Pasanganmu sedang menunggumu untuk bermain.</p>

            <div className="mt-6 flex w-full max-w-sm flex-col items-center rounded-xl border border-white/5 bg-[#18181C] p-6">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Sesi Aktif</span>
              <span className="mt-2 font-mono text-2xl font-bold tracking-widest text-[#FF3D7F]">
                {sessionCode}
              </span>
              {extraInfo && (
                <p className="mt-2 text-xs text-[#5C5470]">{extraInfo}</p>
              )}
            </div>

            {onJoin && (
              <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
                <button
                  type="button"
                  onClick={onJoin}
                  disabled={joinLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.3)] transition hover:bg-[#FF6B9D] disabled:cursor-not-allowed disabled:opacity-60"
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
                  Join Sesi Sekarang
                </button>
              </div>
            )}
          </>
        )}

        {/* Cancel button — always shown */}
        <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
          >
            Batalkan Sesi
          </button>
        </div>
      </div>
    </div>
  );
}
