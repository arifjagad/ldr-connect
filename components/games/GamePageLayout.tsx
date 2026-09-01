"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { GameWaitingLobby } from "@/components/games/GameWaitingLobby";
import { RealtimeBanner } from "@/components/games/RealtimeBanner";
import { VideoCall } from "@/components/VideoCall";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GamePageLayoutProps {
  // ── Identity ────────────────────────────────────────────────────────────────
  /** Display name: "Truth or Dare", "Quoridor", etc. */
  gameName: string;
  /** Emoji: "🔥", "♟️", etc. */
  gameEmoji: string;
  /** URL slug: "tod", "snake-ladder", "dare-derby", "quoridor" */
  gameSlug: string;
  /** Subtitle under game name */
  gameSubtitle: string;
  /** Primary accent color hex */
  accentColor: string;
  /** Lighter accent color hex */
  accentColorLight: string;

  // ── Phase ───────────────────────────────────────────────────────────────────
  phase: "idle" | "waiting" | "playing" | "finished";

  // ── Idle phase ──────────────────────────────────────────────────────────────
  /** Content for the idle phase (GameIdleLayout or custom) */
  idleContent?: ReactNode;

  // ── Waiting phase ───────────────────────────────────────────────────────────
  sessionCode?: string;
  isHost?: boolean;
  onCancel?: () => void;
  onJoin?: () => void;
  joinLoading?: boolean;
  expiryMinutes?: number;
  waitingTimerSeconds?: number | null;
  waitingExtraInfo?: ReactNode;

  // ── Playing phase ───────────────────────────────────────────────────────────
  /** Realtime connection ok? */
  realtimeOk?: boolean;
  /** The game content (board, cards, mini-game, etc.) */
  playingContent?: ReactNode;

  // ── Video call ──────────────────────────────────────────────────────────────
  showVideo?: boolean;
  videoSessionCode?: string;
  videoGame?: "tod" | "snake-ladder" | "dare-derby" | "quoridor";
  onVideoLeave?: () => void;

  // ── Finished phase ──────────────────────────────────────────────────────────
  /** Content for finished phase (GameFinishedCard) */
  finishedContent?: ReactNode;

  // ── Error ───────────────────────────────────────────────────────────────────
  /** Error text shown below waiting lobby (if any) */
  waitingError?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GamePageLayout({
  gameName,
  gameEmoji,
  gameSubtitle,
  phase,
  // Idle
  idleContent,
  // Waiting
  sessionCode,
  isHost = false,
  onCancel,
  onJoin,
  joinLoading,
  expiryMinutes = 10,
  waitingTimerSeconds,
  waitingExtraInfo,
  // Playing
  realtimeOk = true,
  playingContent,
  // Video
  showVideo,
  videoSessionCode,
  videoGame,
  onVideoLeave,
  // Finished
  finishedContent,
  // Error
  waitingError,
}: GamePageLayoutProps) {
  // ── IDLE ────────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <main className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <GameHeader
          gameName={gameName}
          gameEmoji={gameEmoji}
          gameSubtitle={gameSubtitle}
        />

        {idleContent}
      </main>
    );
  }

  // ── WAITING ─────────────────────────────────────────────────────────────────
  if (phase === "waiting" && sessionCode) {
    return (
      <main className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <GameHeader
          gameName={gameName}
          gameEmoji={gameEmoji}
          gameSubtitle={gameSubtitle}
        />

        <GameWaitingLobby
          sessionCode={sessionCode}
          gameName={gameName}
          gameEmoji={gameEmoji}
          isHost={isHost}
          onCancel={onCancel ?? (() => {})}
          onJoin={onJoin}
          joinLoading={joinLoading}
          expiryMinutes={expiryMinutes}
          timerSeconds={waitingTimerSeconds}
          extraInfo={waitingExtraInfo}
        />

        {waitingError && (
          <div className="mx-auto mt-4 max-w-md flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {waitingError}
          </div>
        )}
      </main>
    );
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────────
  if (phase === "playing") {
    return (
      <>
        <RealtimeBanner realtimeOk={realtimeOk} />
        <main className="relative mx-auto w-full max-w-5xl px-4 py-6 lg:px-6">
          {playingContent}

          {/* Video call floating panel */}
          {showVideo && videoSessionCode && (
            <VideoCall
              sessionCode={videoSessionCode}
              game={videoGame}
              onLeave={onVideoLeave}
            />
          )}
        </main>
      </>
    );
  }

  // ── FINISHED ────────────────────────────────────────────────────────────────
  if (phase === "finished") {
    return (
      <main className="relative mx-auto w-full max-w-md px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {finishedContent}
      </main>
    );
  }

  return null;
}

// ── Sub-component: Game Header (breadcrumb + title) ───────────────────────────

function GameHeader({
  gameName,
  gameEmoji,
  gameSubtitle,
}: {
  gameName: string;
  gameEmoji: string;
  gameSubtitle: string;
}) {
  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
        <Link href="/dashboard/games" className="transition hover:text-[#B33E26]">
          Games
        </Link>
        <span>/</span>
        <span>{gameName}</span>
      </div>

      <div className="mt-3 flex items-center gap-3.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E7E5E4] bg-white text-2xl shadow-xs">
          {gameEmoji}
        </div>
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
            {gameName}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-[#78716C]">{gameSubtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ── Suspense Fallback Skeleton ────────────────────────────────────────────────

export function GamePageSkeleton() {
  return (
    <main className="relative mx-auto w-full max-w-5xl px-6 py-12 lg:px-8">
      <div className="rounded-2xl border border-[#E7E5E4] bg-white p-8 text-center shadow-xl shadow-black/2">
        <div className="animate-pulse space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#F5F5F4]" />
          <div className="mx-auto h-4 w-28 rounded-md bg-[#F5F5F4]" />
          <div className="mx-auto h-3 w-40 rounded-md bg-[#F5F5F4]" />
        </div>
      </div>
    </main>
  );
}
