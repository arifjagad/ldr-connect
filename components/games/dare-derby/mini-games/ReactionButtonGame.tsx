"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  duration?: number;
  startedAt?: number;
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

const GRACE_PERIOD_SECONDS = 2;
const TOO_EARLY_PENALTY_MS = 800;

function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration + GRACE_PERIOD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
}

type State = "waiting" | "ready" | "too_early" | "tapped" | "timeout";

export function ReactionButtonGame({ duration = 8, startedAt, bonusActive = false, onComplete }: Props) {
  const [state, setState]         = useState<State>("waiting");
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(() => calcRemaining(duration, startedAt));

  const gameStartRef      = useRef(startedAt ?? Date.now());
  const completedRef      = useRef(false);
  const appearTimeRef     = useRef<number | null>(null);
  // stateRef: sumber kebenaran untuk state di dalam callbacks async
  // (React state bisa stale di dalam setTimeout/setInterval)
  const stateRef          = useRef<State>("waiting");

  // setState yang selalu sinkron dengan stateRef
  const setStateSafe = useCallback((s: State) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const finish = useCallback((score: number, ms: number | null) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    onComplete(score, timeTaken, { reaction_ms: ms });
  }, [onComplete]);

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = calcRemaining(duration, startedAt);
      setCountdown(remaining);
      if (remaining <= 0 && !completedRef.current) {
        clearInterval(id);
        setStateSafe("timeout");
        finish(0, null);
      }
    }, 250);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startedAt]);

  // ── Tombol muncul (random delay) ───────────────────────────────────────────
  useEffect(() => {
    if (calcRemaining(duration, startedAt) <= 0) {
      setStateSafe("timeout");
      finish(0, null);
      return;
    }
    const remaining = calcRemaining(duration, startedAt) * 1000;
    const maxDelay  = Math.min(remaining - 500, 3500);
    if (maxDelay <= 0) return;
    const delay = 1000 + Math.random() * Math.min(maxDelay - 1000, 2000);

    const t = setTimeout(() => {
      if (completedRef.current) return;
      // Langsung tampilkan tombol apapun state saat ini (termasuk jika masih too_early).
      // Ini mencegah race condition: too_early penalty 800ms menimpa setState("ready").
      appearTimeRef.current = Date.now();
      setStateSafe("ready");
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (completedRef.current) return;

    const current = stateRef.current;

    if (current === "waiting") {
      // Tap sebelum tombol muncul → penalty visual saja (bukan penalty gameplay)
      // State tetap "too_early" sampai tombol muncul atau timer habis
      setStateSafe("too_early");
      // Kembali ke waiting setelah 800ms — HANYA jika tombol belum muncul
      // Jika tombol sudah muncul, setStateSafe("ready") di setTimeout tombol sudah dijalankan
      const penaltyTimer = setTimeout(() => {
        if (completedRef.current) return;
        // Cek via stateRef: jika masih "too_early" (tombol belum muncul), kembali ke waiting
        // Jika sudah "ready" (tombol muncul selama penalty), biarkan saja
        if (stateRef.current === "too_early") {
          setStateSafe("waiting");
        }
      }, TOO_EARLY_PENALTY_MS);
      return;
    }

    if (current === "too_early") {
      // Tap saat animasi too_early — abaikan
      return;
    }

    if (current !== "ready") return;

    // ✅ Tap yang valid saat tombol tampil
    const ms = Date.now() - (appearTimeRef.current ?? Date.now());
    setReactionMs(ms);
    setStateSafe("tapped");
    // Skor minimum 10 untuk tap yang valid — 0 hanya jika benar-benar timeout.
    // Ini fair karena too_early penalty (800ms) memotong window reaksi player.
    const rawScore = 100 - Math.floor(ms / 30);
    finish(Math.max(10, rawScore), ms);
  }, [finish, setStateSafe]);

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      <div className="text-center">
        <p className="text-sm font-medium text-[#9B93B0]">⚡ React!</p>
        <p className="mt-1 text-xs text-[#5C5470]">Tap tombol secepat mungkin saat muncul!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 text-xs font-bold text-yellow-400">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="w-full text-right text-xs text-[#5C5470]">{countdown}s</div>

      <div
        className="w-full flex items-center justify-center"
        style={{ minHeight: 160 }}
        onClick={handleTap}
      >
        {state === "waiting" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#5C5470] flex items-center justify-center">
              <span className="text-2xl animate-pulse">⏳</span>
            </div>
            <p className="text-sm text-[#5C5470]">Bersiap...</p>
          </div>
        )}
        {state === "too_early" && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">❌</span>
            <p className="text-sm text-red-400">Terlalu cepat!</p>
          </div>
        )}
        {state === "ready" && (
          <button className="w-40 h-40 rounded-full bg-[#FF3D7F] hover:bg-[#FF6B9D] text-white text-2xl font-bold shadow-[0_0_40px_rgba(255,61,127,0.5)] animate-bounce active:scale-95 transition">
            TAP!
          </button>
        )}
        {state === "tapped" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-4xl font-bold text-[#FFF5F8]">{reactionMs}ms</p>
            <p className="text-sm text-[#9B93B0]">
              {reactionMs! < 300 ? "Luar biasa!" : reactionMs! < 500 ? "Bagus!" : reactionMs! < 800 ? "Lumayan" : "Pelan..."}
            </p>
          </div>
        )}
        {state === "timeout" && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">😴</span>
            <p className="text-sm text-[#5C5470]">Waktu habis!</p>
          </div>
        )}
      </div>
    </div>
  );
}
