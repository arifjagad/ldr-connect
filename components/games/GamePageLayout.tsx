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
  gameSlug,
  gameSubtitle,
  accentColor,
  accentColorLight,
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
      <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: `radial-gradient(ellipse, ${accentColor}1a 0%, transparent 70%)` }}
        />

        <GameHeader
          gameName={gameName}
          gameEmoji={gameEmoji}
          gameSlug={gameSlug}
          gameSubtitle={gameSubtitle}
          accentColor={accentColor}
          accentColorLight={accentColorLight}
        />

        {idleContent}
      </main>
    );
  }

  // ── WAITING ─────────────────────────────────────────────────────────────────
  if (phase === "waiting" && sessionCode) {
    return (
      <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
        <GameHeader
          gameName={gameName}
          gameEmoji={gameEmoji}
          gameSlug={gameSlug}
          gameSubtitle={gameSubtitle}
          accentColor={accentColor}
          accentColorLight={accentColorLight}
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
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
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
        <main className="relative mx-auto w-full max-w-5xl px-4 py-4 lg:px-6">
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
      <main className="relative mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
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
  gameSlug,
  gameSubtitle,
  accentColor,
  accentColorLight,
}: {
  gameName: string;
  gameEmoji: string;
  gameSlug: string;
  gameSubtitle: string;
  accentColor: string;
  accentColorLight: string;
}) {
  // Capitalize first letter for breadcrumb slug display
  const breadcrumbName = gameName;

  return (
    <div className="mb-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
        <Link href="/dashboard/games" className="transition hover:text-[#9B93B0]">
          Games
        </Link>
        {" / "}{breadcrumbName}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{
            background: `linear-gradient(135deg, ${accentColor}4d, ${accentColorLight}33)`,
          }}
        >
          {gameEmoji}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#FFF5F8] sm:text-3xl">
            {gameName}
          </h1>
          <p className="text-sm text-[#5C5470]">{gameSubtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ── Suspense Fallback Skeleton ────────────────────────────────────────────────

export function GamePageSkeleton() {
  return (
    <main className="relative mx-auto w-full max-w-5xl px-6 py-12 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-[#111113] p-6 text-center">
        <div className="animate-pulse space-y-4">
          <div className="mx-auto h-12 w-12 rounded-lg bg-white/10" />
          <div className="mx-auto h-4 w-24 rounded bg-white/10" />
          <div className="mx-auto h-3 w-32 rounded bg-white/10" />
        </div>
      </div>
    </main>
  );
}
