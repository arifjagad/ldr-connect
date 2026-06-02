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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFinishStyles(type: FinishType) {
  switch (type) {
    case "win":
    case "complete":
      return {
        emoji: type === "win" ? "🎉" : "🎉",
        borderColor: "rgba(52,211,153,0.20)",
        barBg: "linear-gradient(90deg, #34D399, #6EE7B7)",
        statsBg: "rgba(52,211,153,0.06)",
        statsBorder: "rgba(52,211,153,0.15)",
        konfetti: true,
      };
    case "lose":
      return {
        emoji: "😢",
        borderColor: "rgba(129,140,248,0.20)",
        barBg: "linear-gradient(90deg, #818CF8, #A78BFA)",
        statsBg: "rgba(129,140,248,0.06)",
        statsBorder: "rgba(129,140,248,0.15)",
        konfetti: false,
      };
    case "time_up":
      return {
        emoji: "⏰",
        borderColor: "rgba(251,191,36,0.25)",
        barBg: "linear-gradient(90deg, #FBBF24, #F59E0B)",
        statsBg: "rgba(251,191,36,0.06)",
        statsBorder: "rgba(251,191,36,0.15)",
        konfetti: false,
      };
    case "draw":
      return {
        emoji: "🤝",
        borderColor: "rgba(251,191,36,0.20)",
        barBg: "linear-gradient(90deg, #FBBF24, #F59E0B)",
        statsBg: "rgba(251,191,36,0.06)",
        statsBorder: "rgba(251,191,36,0.15)",
        konfetti: false,
      };
    case "cancelled":
      return {
        emoji: "❌",
        borderColor: "rgba(248,113,113,0.20)",
        barBg: "linear-gradient(90deg, #F87171, #FCA5A5)",
        statsBg: "rgba(248,113,113,0.06)",
        statsBorder: "rgba(248,113,113,0.15)",
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
}: GameFinishedCardProps) {
  const styles = getFinishStyles(finishType);
  const shouldKonfetti = showKonfetti ?? styles.konfetti;

  return (
    <>
      <Konfetti active={shouldKonfetti} />

      <div
        className="overflow-hidden rounded-2xl border bg-[#111113]"
        style={{ borderColor: styles.borderColor }}
      >
        <div className="h-1 w-full" style={{ background: styles.barBg }} />

        <div className="p-6 text-center sm:p-8">
          {/* Emoji */}
          <div className="mb-4 text-5xl">{styles.emoji}</div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-[#FFF5F8]">{title}</h2>

          {/* Subtitle */}
          <p className="mt-2 text-sm text-[#9B93B0]">{subtitle}</p>

          {/* Stats card */}
          <div
            className="mx-auto mt-6 max-w-xs space-y-3 rounded-2xl border p-4 text-left"
            style={{ borderColor: styles.statsBorder, background: styles.statsBg }}
          >
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
            />

            {/* Main Lagi */}
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#818CF8] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(129,140,248,0.3)] transition hover:bg-[#A78BFA]"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              Lihat History
            </Link>

            {/* Back to Games */}
            <Link
              href="/dashboard/games"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
            >
              Kembali ke Games
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
