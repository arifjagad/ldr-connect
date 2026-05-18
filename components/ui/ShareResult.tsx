"use client";

import { useState } from "react";

interface ShareResultProps {
  gameName: string;
  gameEmoji: string;
  result: "win" | "lose" | "draw" | "complete";
  /** Teks tambahan, misal "15/15 pertanyaan" atau "Ronde 5/5" */
  summary?: string;
  /** Nama partner opsional */
  partnerName?: string;
}

const RESULT_CONFIG = {
  win: {
    emoji: "🏆",
    label: "Menang!",
    color: "#FBBF24",
    bg: "border-yellow-500/30 bg-yellow-500/10",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Aku baru aja menang ${game} di LDR-Connect! 🏆${partner ? ` vs ${partner}` : ""}${summary ? `\n${summary}` : ""}\n\nMain bareng pasangan kamu juga di ldr-connect.app 💕`,
  },
  lose: {
    emoji: "😅",
    label: "Kalah nih...",
    color: "#F87171",
    bg: "border-red-500/20 bg-red-500/8",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Baru main ${game} di LDR-Connect${partner ? ` sama ${partner}` : ""} dan kalah 😅${summary ? `\n${summary}` : ""}\n\nRevans besok! Main juga di ldr-connect.app 💕`,
  },
  draw: {
    emoji: "🤝",
    label: "Seri!",
    color: "#9B93B0",
    bg: "border-white/20 bg-white/5",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Seri di ${game}${partner ? ` bareng ${partner}` : ""} di LDR-Connect! 🤝${summary ? `\n${summary}` : ""}\n\nRematch segera! ldr-connect.app 💕`,
  },
  complete: {
    emoji: "🎉",
    label: "Selesai!",
    color: "#34D399",
    bg: "border-[#34D399]/25 bg-[#34D399]/8",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Baru selesai main ${game}${partner ? ` bareng ${partner}` : ""} di LDR-Connect! 🎉${summary ? `\n${summary}` : ""}\n\nSeru banget! Coba juga di ldr-connect.app 💕`,
  },
};

export function ShareResult({
  gameName,
  gameEmoji,
  result,
  summary,
  partnerName,
}: ShareResultProps) {
  const [copied, setCopied] = useState(false);
  const config = RESULT_CONFIG[result];
  const shareText = config.shareText(gameName, summary, partnerName);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  async function handleCopyText() {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const canNativeShare =
    typeof navigator !== "undefined" && !!navigator.share;

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: `LDR-Connect — ${gameName}`,
        text: shareText,
      });
    } catch {
      // user dismissed — ignore
    }
  }

  return (
    <div className={`overflow-hidden rounded-2xl border ${config.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: config.color }}>
            {config.label}
          </p>
          <p className="text-xs text-[#5C5470]">
            {gameEmoji} {gameName}
            {summary ? ` · ${summary}` : ""}
            {partnerName ? ` · vs ${partnerName}` : ""}
          </p>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex items-center gap-2 px-4 py-3">
        <p className="mr-auto text-xs text-[#5C5470]">Bagikan momen ini:</p>

        {/* WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#25D366] ring-1 ring-[#25D366]/30 transition hover:bg-[#25D366]/20"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M11.99 2C6.477 2 2 6.484 2 12.017c0 1.99.522 3.855 1.442 5.465L2.02 22l4.641-1.404A9.96 9.96 0 0011.99 22C17.515 22 22 17.516 22 12.017 22 6.508 17.515 2 11.99 2zm0 18.044a8.018 8.018 0 01-4.098-1.126l-.294-.175-3.049.922.882-3.045-.192-.313A8.003 8.003 0 013.977 12c0-4.418 3.585-8.017 8.013-8.017 4.419 0 8.014 3.6 8.014 8.017 0 4.419-3.595 8.044-8.014 8.044z" />
          </svg>
          WA
        </a>

        {/* Native Share (mobile) */}
        {canNativeShare ? (
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-[#9B93B0] ring-1 ring-white/[0.07] transition hover:bg-white/10"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" strokeLinecap="round" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
            </svg>
            Share
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCopyText}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition ${
              copied
                ? "bg-[#34D399]/15 text-[#34D399] ring-[#34D399]/30"
                : "bg-white/5 text-[#9B93B0] ring-white/[0.07] hover:bg-white/10"
            }`}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Tersalin
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
