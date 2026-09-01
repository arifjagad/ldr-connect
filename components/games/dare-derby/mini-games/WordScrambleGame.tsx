"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  duration?: number;
  startedAt?: number;   // unix ms — untuk timeTaken saja, BUKAN untuk countdown
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

const WORDS = [
  "cinta", "sayang", "rindu", "bahagia", "indah",
  "mimpi", "manis", "lembut", "senang", "damai",
  "hangat", "cantik", "perhatian", "kebersamaan", "harapan",
];

function scramble(word: string): string {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (arr.join("") === word && word.length > 1) [arr[0], arr[1]] = [arr[1], arr[0]];
  return arr.join("");
}

export function WordScrambleGame({ duration = 20, startedAt, bonusActive = false, onComplete }: Props) {
  const [word] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [scrambled] = useState(() => {
    let s = scramble(word);
    let attempts = 0;
    while (s === word && attempts < 10) { s = scramble(word); attempts++; }
    return s;
  });
  const [input, setInput]   = useState("");
  const [status, setStatus] = useState<"playing" | "correct" | "wrong" | "timeout">("playing");
  const [timeLeft, setTimeLeft] = useState(duration); // mulai dari durasi penuh

  const gameStartRef = useRef(startedAt ?? Date.now());
  const mountedAtRef = useRef(Date.now());
  const completedRef = useRef(false);
  const inputRef     = useRef<HTMLInputElement>(null);
  // onCompleteRef: selalu up-to-date agar finish() tidak tangkap onComplete stale
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const finish = useCallback((correct: boolean, tl: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    const timeBonus = correct ? Math.max(0, Math.floor((tl / duration) * 20)) : 0;
    onCompleteRef.current(correct ? Math.min(100, 80 + timeBonus) : 0, timeTaken, { word, correct });
  // word & duration stabil selama game; onComplete diganti pakai ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, duration]);

  // ── Countdown — dihitung dari mountedAt, bukan startedAt ──────────────────
  // Menggunakan mountedAt memastikan setiap player selalu mendapat durasi penuh
  // dari saat mereka MELIHAT game, terlepas dari delay network/render.
  useEffect(() => {
    inputRef.current?.focus();
    const id = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - mountedAtRef.current) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0 && !completedRef.current) {
        clearInterval(id);
        setStatus("timeout");
        finish(false, 0);
      }
    }, 250);
    return () => clearInterval(id);
  // `finish` stabil (useCallback); `duration` tidak berubah selama game.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (completedRef.current || status !== "playing") return;
    const correct = input.trim().toLowerCase() === word;
    setStatus(correct ? "correct" : "wrong");
    finish(correct, timeLeft);
  };

  const urgent = timeLeft <= 5;

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🎯 Acak Kata</p>
        <p className="mt-1 text-xs text-[#78716C]">Susun huruf acak menjadi kata yang benar!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706]">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-[#C84B31]">{word.length} huruf</span>
        <span
          className={`text-sm font-bold tabular-nums ${
            timeLeft <= 5
              ? "text-red-500 animate-pulse"
              : timeLeft <= 10
              ? "text-[#D97706]"
              : "text-[#1F1D1B]"
          }`}
        >
          {timeLeft}s
        </span>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        {scrambled.split("").map((letter, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-xl border border-[#FBDCD5] bg-[#FDF4F2] flex items-center justify-center text-lg font-serif font-bold text-[#C84B31] uppercase shadow-2xs"
          >
            {letter}
          </div>
        ))}
      </div>

      {status === "playing" ? (
        <div className="w-full flex flex-col gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.toLowerCase())}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="Ketik jawaban..."
            className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-3 text-center text-[#1F1D1B] text-lg font-semibold outline-none focus:border-[#C84B31] focus:bg-white focus:ring-2 focus:ring-[#C84B31]/10 transition"
            maxLength={20}
            autoComplete="off"
          />
          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl bg-[#C84B31] hover:bg-[#B33E26] text-white font-semibold text-xs shadow-xs transition active:scale-95 cursor-pointer"
          >
            Jawab
          </button>
        </div>
      ) : (
        <div className="w-full text-center py-4 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
          {status === "correct" && (
            <>
              <p className="text-4xl mb-1">✅</p>
              <p className="text-xl font-serif font-bold text-emerald-600">{word.toUpperCase()}</p>
              <p className="text-xs text-[#78716C] font-semibold mt-1">Benar!</p>
            </>
          )}
          {(status === "wrong" || status === "timeout") && (
            <>
              <p className="text-4xl mb-1">{status === "wrong" ? "❌" : "⏰"}</p>
              <p className="text-xs text-[#78716C]">Jawabannya: <span className="text-[#1F1D1B] font-serif font-bold">{word.toUpperCase()}</span></p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
