"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Konfetti } from "@/components/ui/Konfetti";
import { ShareResult } from "@/components/ui/ShareResult";

// ── Types ─────────────────────────────────────────────────────────────────────

type FinishType = "win" | "lose" | "draw" | "complete" | "time_up" | "cancelled";

interface GameFinishedCardProps {
  /** Game name for share */
  gameName: string;
  /** Game emoji for share */
  gameEmoji: string;
  /** Type of finish — determines colors, emoji, konfetti */
  finishType: FinishType;
  /** Main result title: "Kamu Menang!", "Waktu Habis!", etc. */
  title: string;
  /** Subtitle description */
  subtitle: string;
  /** Game-specific stats to render inside the stats card */
  statsContent: ReactNode;
  /** Summary text for share */
  shareSummary: string;
  /** Callback when "Main Lagi" is clicked */
  onPlayAgain: () => void;
  /** Show konfetti? Default: true for win/complete */
  showKonfetti?: boolean;
  /** Profile data for share image — opsional, jika tidak ada tampilkan inisial */
  myName?: string;
  myAvatarUrl?: string | null;
  partnerName?: string;
  partnerAvatarUrl?: string | null;
  playedAt?: string;
  /** Statistik terstruktur untuk card gambar share */
  shareStats?: Array<{ label: string; value: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFinishStyles(type: FinishType) {
  switch (type) {
    case "win":
    case "complete":
      return {
        emoji: "🎉",
        badgeBg: "bg-[#EBF9EB]",
        badgeText: "text-[#10B981]",
        konfetti: true,
      };
    case "lose":
      return {
        emoji: "😢",
        badgeBg: "bg-[#EEF2FF]",
        badgeText: "text-[#4F46E5]",
        konfetti: false,
      };
    case "time_up":
      return {
        emoji: "⏰",
        badgeBg: "bg-[#FEF3C7]",
        badgeText: "text-[#D97706]",
        konfetti: false,
      };
    case "draw":
      return {
        emoji: "🤝",
        badgeBg: "bg-[#FEF3C7]",
        badgeText: "text-[#D97706]",
        konfetti: false,
      };
    case "cancelled":
      return {
        emoji: "❌",
        badgeBg: "bg-red-50",
        badgeText: "text-red-600",
        konfetti: false,
      };
  }
}

// Maps FinishType to ShareResult's expected result type
function toShareResult(type: FinishType): "win" | "lose" | "draw" | "complete" {
  if (type === "time_up" || type === "cancelled") return "complete";
  return type;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GameFinishedCard({
  gameName,
  gameEmoji,
  finishType,
  title,
  subtitle,
  statsContent,
  shareSummary,
  onPlayAgain,
  showKonfetti,
  myName,
  myAvatarUrl,
  partnerName,
  partnerAvatarUrl,
  playedAt,
  shareStats,
}: GameFinishedCardProps) {
  const styles = getFinishStyles(finishType);
  const shouldKonfetti = showKonfetti ?? styles.konfetti;

  return (
    <>
      <Konfetti active={shouldKonfetti} />

      <div className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 text-center shadow-xl shadow-black/2">
        {/* Emoji */}
        <div className="mb-4 text-5xl">{styles.emoji}</div>

        {/* Title */}
        <h2 className="font-serif text-3xl font-bold text-[#1F1D1B]">{title}</h2>

        {/* Subtitle */}
        <p className="mt-1.5 text-xs text-[#78716C]">{subtitle}</p>

        {/* Stats card */}
        <div className="mx-auto mt-6 max-w-xs space-y-3 rounded-2xl border border-[#E7E5E4] bg-[#FCFBF7] p-4 text-left">
          {statsContent}
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col gap-3">
          {/* Share */}
          <ShareResult
            gameName={gameName}
            gameEmoji={gameEmoji}
            result={toShareResult(finishType)}
            summary={shareSummary}
            myName={myName}
            myAvatarUrl={myAvatarUrl}
            partnerName={partnerName}
            partnerAvatarUrl={partnerAvatarUrl}
            playedAt={playedAt}
            stats={shareStats}
          />

          {/* Main Lagi */}
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-5 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Main Lagi
          </button>

          {/* History */}
          <Link
            href="/dashboard/games/history"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-5 py-2.5 text-xs font-semibold text-[#78716C] shadow-2xs transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            Lihat Riwayat Game
          </Link>

          {/* Back to Games */}
          <Link
            href="/dashboard/games"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent px-5 py-2 text-xs font-semibold text-[#A8A29E] transition hover:text-[#78716C]"
          >
            Kembali ke Hub Game
          </Link>
        </div>
      </div>
    </>
  );
}
