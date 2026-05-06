"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  duration?: number;
  startedAt?: number;
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

const TOTAL = 9;
const SHOW_MS   = 400;  // durasi tiap angka ditampilkan
const GAP_MS    = 150;  // jeda antar angka saat show

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function NumberOrderGame({ duration = 25, startedAt, bonusActive = false, onComplete }: Props) {
  // Urutan acak yang harus diingat: [3,7,1,9,5,2,8,4,6]
  const [sequence] = useState(() => shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1)));
  // Posisi angka di grid (berbeda dari sequence — ini tampilan grid saja)
  const [gridNums] = useState(() => shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1)));

  // show → input → done
  const [phase, setPhase]               = useState<"show" | "input" | "done">("show");
  const [highlighted, setHighlighted]   = useState<number | null>(null);
  const [showStepLabel, setShowStepLabel] = useState(1); // "Menampilkan X/9"

  // Input state
  const [inputIdx, setInputIdx]         = useState(0);   // index berikutnya yang harus di-tap
  const [wrongFlash, setWrongFlash]     = useState<number | null>(null);
  const [results, setResults]           = useState<(boolean | null)[]>(Array(TOTAL).fill(null));

  // Timer (hanya aktif saat input phase)
  const [timeLeft, setTimeLeft]         = useState(duration);
  const inputStartedAtRef               = useRef<number | null>(null);

  const gameStartRef   = useRef(startedAt ?? Date.now());
  const completedRef   = useRef(false);
  const inputIdxRef    = useRef(0);
  const phaseRef       = useRef<"show" | "input" | "done">("show");

  useEffect(() => { inputIdxRef.current = inputIdx; }, [inputIdx]);
  useEffect(() => { phaseRef.current    = phase;    }, [phase]);

  const finish = useCallback((correct: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    const ratio = correct / TOTAL;
    // Skor: 80–100 jika semua benar (bonus kecepatan), 10–70 proporsional jika parsial
    const elapsed  = inputStartedAtRef.current ? (Date.now() - inputStartedAtRef.current) / 1000 : duration;
    const inputDur = duration - (TOTAL * (SHOW_MS + GAP_MS) / 1000) - 1;
    const speedBonus = correct === TOTAL ? Math.max(0, Math.round((1 - elapsed / Math.max(1, inputDur)) * 20)) : 0;
    const raw = correct === TOTAL
      ? Math.min(100, 80 + speedBonus)
      : Math.max(10, Math.round(ratio * 70));
    onComplete(raw, timeTaken, { correct, total: TOTAL });
  }, [onComplete, duration]);

  // ── Show phase: tampilkan urutan satu per satu ─────────────────────────────
  useEffect(() => {
    if (phase !== "show") return;
    let cancelled = false;
    let step = 0;

    const showNext = () => {
      if (cancelled) return;
      if (step >= TOTAL) {
        // Selesai show → masuk input
        setHighlighted(null);
        setTimeout(() => {
          if (!cancelled) {
            inputStartedAtRef.current = Date.now();
            setPhase("input");
          }
        }, 400);
        return;
      }
      setHighlighted(sequence[step]);
      setShowStepLabel(step + 1);
      step++;
      setTimeout(() => {
        if (cancelled) return;
        setHighlighted(null);
        setTimeout(showNext, GAP_MS);
      }, SHOW_MS);
    };

    const initDelay = setTimeout(showNext, 500); // jeda kecil sebelum mulai
    return () => { cancelled = true; clearTimeout(initDelay); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Countdown (hanya saat input) ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== "input") return;
    const id = setInterval(() => {
      if (!inputStartedAtRef.current) return;
      const elapsed   = Math.floor((Date.now() - inputStartedAtRef.current) / 1000);
      const remaining = Math.max(0, duration - Math.floor(TOTAL * (SHOW_MS + GAP_MS) / 1000) - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0 && !completedRef.current) {
        clearInterval(id);
        setPhase("done");
        finish(inputIdxRef.current); // berapa yang sudah benar
      }
    }, 250);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = (num: number) => {
    if (phaseRef.current !== "input" || completedRef.current) return;
    const expected = sequence[inputIdxRef.current];

    if (num === expected) {
      // ✅ Benar
      const newResults = [...results];
      newResults[inputIdxRef.current] = true;
      setResults(newResults);
      const newIdx = inputIdxRef.current + 1;
      setInputIdx(newIdx);
      if (newIdx >= TOTAL) {
        setPhase("done");
        finish(TOTAL);
      }
    } else {
      // ❌ Salah — flash merah, catat hasil, tetap lanjut ke angka berikutnya
      setWrongFlash(num);
      setTimeout(() => setWrongFlash(null), 350);
      const newResults = [...results];
      newResults[inputIdxRef.current] = false;
      setResults(newResults);
      const newIdx = inputIdxRef.current + 1;
      setInputIdx(newIdx);
      if (newIdx >= TOTAL) {
        setPhase("done");
        const correctCount = newResults.filter(Boolean).length;
        finish(correctCount);
      }
    }
  };

  const urgent = phase === "input" && timeLeft <= 5;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="text-center">
        <p className="text-sm font-medium text-[#9B93B0]">🔢 Urutan Angka</p>
        <p className="mt-1 text-xs text-[#5C5470]">
          {phase === "show"
            ? "Perhatikan urutan angka yang menyala!"
            : phase === "input"
            ? "Tap angka sesuai urutan yang tadi muncul!"
            : "Selesai!"}
        </p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 text-xs font-bold text-yellow-400">
          +50 BONUS AKTIF!
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between w-full text-xs">
        {phase === "show" ? (
          <span className="text-[#818CF8] font-bold animate-pulse">
            Menampilkan {showStepLabel}/{TOTAL}...
          </span>
        ) : phase === "input" ? (
          <span className="text-[#818CF8] font-bold">
            {inputIdx}/{TOTAL} ✓
          </span>
        ) : (
          <span className="text-green-400 font-bold">✅ Selesai!</span>
        )}
        {phase === "input" && (
          <span className={urgent ? "text-red-400 font-bold animate-pulse" : "text-[#5C5470]"}>
            {timeLeft}s
          </span>
        )}
      </div>

      {/* Progress dots — urutan hasil input */}
      <div className="flex gap-1.5">
        {results.map((r, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              r === null   ? "bg-white/10"
              : r === true ? "bg-green-500"
              : "bg-red-500"
            }`}
          />
        ))}
      </div>

      {/* Grid 3×3 */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {gridNums.map((num, cellIdx) => {
          const isHighlighted = highlighted === num;
          const isWrong       = wrongFlash === num;

          return (
            <button
              key={cellIdx}
              onClick={() => handleTap(num)}
              disabled={phase !== "input"}
              className={`
                h-16 rounded-2xl text-2xl font-bold transition-all duration-150 active:scale-95
                ${isHighlighted
                  ? "bg-[#818CF8] border-2 border-[#818CF8] text-white scale-105 shadow-[0_0_20px_rgba(129,140,248,0.6)]"
                  : isWrong
                  ? "bg-red-500/40 border-2 border-red-500 text-red-300 scale-95"
                  : phase === "input"
                  ? "bg-white/5 border-2 border-white/15 text-[#FFF5F8] hover:border-[#818CF8]/40 hover:bg-[#818CF8]/10"
                  : "bg-white/5 border-2 border-white/10 text-[#5C5470]"
                }
              `}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Done state */}
      {phase === "done" && (
        <div className="text-center mt-1">
          <p className="text-sm text-[#9B93B0]">
            {results.filter(Boolean).length}/{TOTAL} benar
          </p>
        </div>
      )}
    </div>
  );
}
