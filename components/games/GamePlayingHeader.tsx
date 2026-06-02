"use client";

import type { ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GamePlayingHeaderProps {
  /** Session code — hidden on mobile */
  sessionCode?: string;
  /** Status text: "Giliranmu", "Giliran partner", "Ronde 3/5" */
  statusText: string;
  /** Color for the status text */
  statusColor?: string;
  /** Timer in seconds (null = not started) */
  timerSeconds: number | null;
  /** Total timer duration in seconds — for the progress bar width */
  timerTotalSeconds?: number;
  /** Partner online/offline */
  partnerOnline: boolean;
  /** Whether video call panel is open */
  showVideo: boolean;
  /** Toggle video call */
  onToggleVideo: () => void;
  /** Leave / exit game */
  onLeave: () => void;
  /** Realtime connection status */
  realtimeOk?: boolean;
  /** Additional elements on the left side (after status) */
  extraLeft?: ReactNode;
  /** Additional elements on the right side (before timer) */
  extraRight?: ReactNode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimer(s: number | null): { mm: string; ss: string } {
  if (s === null) return { mm: "--", ss: "--" };
  return {
    mm: String(Math.floor(s / 60)).padStart(2, "0"),
    ss: String(s % 60).padStart(2, "0"),
  };
}

function timerColor(pct: number): string {
  if (pct > 50) return "#34D399";
  if (pct > 20) return "#FBBF24";
  return "#FF3D7F";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GamePlayingHeader({
  sessionCode,
  statusText,
  statusColor = "#818CF8",
  timerSeconds,
  timerTotalSeconds = 600,
  partnerOnline,
  showVideo,
  onToggleVideo,
  onLeave,
  realtimeOk = true,
  extraLeft,
  extraRight,
}: GamePlayingHeaderProps) {
  const { mm, ss } = formatTimer(timerSeconds);
  const pct = timerSeconds !== null ? (timerSeconds / timerTotalSeconds) * 100 : 100;
  const color = timerColor(pct);

  return (
    <div className="mb-3 rounded-2xl border border-white/[0.07] bg-[#111113] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {/* Left side */}
        <div className="flex min-w-0 items-center gap-2">
          {sessionCode && (
            <>
              <span className="hidden shrink-0 font-mono text-xs tracking-widest text-[#5C5470] sm:inline">
                {sessionCode}
              </span>
              <span className="hidden h-1 w-1 shrink-0 rounded-full bg-[#5C5470] sm:inline-block" />
            </>
          )}

          <span
            className="truncate text-xs font-medium"
            style={{ color: statusColor }}
          >
            {statusText}
          </span>

          {/* Partner online indicator */}
          <span
            className="hidden items-center gap-1.5 text-[10px] sm:flex"
            title={partnerOnline ? "Partner online" : "Partner offline"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                partnerOnline ? "bg-[#34D399]" : "bg-[#5C5470]"
              }`}
            />
            <span className={partnerOnline ? "text-[#34D399]" : "text-[#5C5470]"}>
              {partnerOnline ? "Online" : "Offline"}
            </span>
          </span>

          {/* Realtime warning */}
          {!realtimeOk && (
            <span
              className="hidden items-center gap-1.5 text-[10px] text-[#FBBF24] sm:flex"
              title="Koneksi realtime terputus"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FBBF24]" />
              Koneksi lemah
            </span>
          )}

          {extraLeft}
        </div>

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-2">
          {extraRight}

          {/* Timer */}
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
            {mm}:{ss}
          </span>

          {/* Video toggle */}
          <button
            type="button"
            onClick={onToggleVideo}
            title={showVideo ? "Tutup video call" : "Buka video call"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
              showVideo
                ? "border-[#34D399]/40 bg-[#34D399]/15 text-[#34D399]"
                : "border-white/10 bg-white/5 text-[#5C5470] hover:text-[#9B93B0]"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>

          {/* Leave */}
          <button
            type="button"
            onClick={onLeave}
            className="text-xs text-[#5C5470] transition hover:text-[#9B93B0]"
          >
            Keluar
          </button>
        </div>
      </div>

      {/* Timer progress bar */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
