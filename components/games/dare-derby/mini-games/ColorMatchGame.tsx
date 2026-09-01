"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  duration?: number;
  startedAt?: number;   // unix ms — timestamp server saat ronde mulai
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

// ── 12 warna — pool besar agar game lebih menantang ─────────────────────────
const ALL_COLORS = [
  { id: "merah",     hex: "#EF4444" },
  { id: "biru",      hex: "#3B82F6" },
  { id: "hijau",     hex: "#22C55E" },
  { id: "kuning",    hex: "#EAB308" },
  { id: "ungu",      hex: "#A855F7" },
  { id: "oranye",    hex: "#F97316" },
  { id: "pink",      hex: "#EC4899" },
  { id: "cyan",      hex: "#06B6D4" },
  { id: "lime",      hex: "#84CC16" },
  { id: "rose",      hex: "#F43F5E" },
  { id: "teal",      hex: "#14B8A6" },
  { id: "amber",     hex: "#F59E0B" },
];

// Jumlah opsi yang ditampilkan per ronde (grid 2×3)
const OPTIONS_PER_ROUND = 6;

interface Round {
  wordText: string;    // kata yang ditampilkan, e.g. "MERAH"
  displayColor: string; // warna TAMPILAN (hex), e.g. biru → #3B82F6
  correctId: string;   // id warna yang benar = warna TAMPILAN, e.g. "biru"
  options: typeof ALL_COLORS; // 6 opsi warna untuk ronde ini
}

const ROUNDS_PER_GAME = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRounds(): Round[] {
  const rounds: Round[] = [];
  for (let i = 0; i < ROUNDS_PER_GAME; i++) {
    // Pilih kata acak
    const wordIdx = Math.floor(Math.random() * ALL_COLORS.length);
    // Pilih warna tampilan yang BERBEDA dari kata
    let colorIdx = Math.floor(Math.random() * ALL_COLORS.length);
    while (colorIdx === wordIdx) {
      colorIdx = Math.floor(Math.random() * ALL_COLORS.length);
    }

    const correctColor = ALL_COLORS[colorIdx];
    const wordColor = ALL_COLORS[wordIdx];

    // Pilih 6 opsi: harus include jawaban benar + kata (pengecoh utama) + 4 acak lainnya
    const mustInclude = new Set([correctColor.id, wordColor.id]);
    const others = shuffle(
      ALL_COLORS.filter(c => !mustInclude.has(c.id))
    ).slice(0, OPTIONS_PER_ROUND - mustInclude.size);

    const options = shuffle([
      correctColor,
      wordColor,
      ...others,
    ]);

    rounds.push({
      wordText: ALL_COLORS[wordIdx].id.toUpperCase(),
      displayColor: ALL_COLORS[colorIdx].hex,
      correctId: ALL_COLORS[colorIdx].id,
      options,
    });
  }
  return rounds;
}

// GRACE_PERIOD: buffer 2 detik untuk latency
const GRACE_PERIOD_SECONDS = 2;

function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration + GRACE_PERIOD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
}

export function ColorMatchGame({ duration = 25, startedAt, bonusActive = false, onComplete }: Props) {
  const [rounds] = useState(() => generateRounds());
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => calcRemaining(duration, startedAt));

  // ── Refs ──────────────────────────────────────────────────────────────────
  const gameStartRef  = useRef(startedAt ?? Date.now());
  const completedRef  = useRef(false);
  const answersRef    = useRef<boolean[]>([]);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalScoreRef = useRef<{ correct: number; total: number } | null>(null);
  // onCompleteRef: selalu up-to-date agar finish() tidak tangkap onComplete stale
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  const finish = useCallback((ans: boolean[]) => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const timeTaken = Date.now() - gameStartRef.current;
    const correct = ans.filter(Boolean).length;
    finalScoreRef.current = { correct, total: ROUNDS_PER_GAME };
    onCompleteRef.current(correct * 10, timeTaken, { correct, total: ROUNDS_PER_GAME });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = calcRemaining(duration, startedAt);
      setTimeLeft(remaining);
      if (remaining === 0 && !completedRef.current) {
        clearInterval(id);
        intervalRef.current = null;
        setDone(true);
        finish(answersRef.current);
      }
    }, 250);
    intervalRef.current = id;
    return () => { clearInterval(id); intervalRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startedAt]);

  // Langsung timeout jika sudah habis saat mount
  useEffect(() => {
    if (calcRemaining(duration, startedAt) === 0) { setDone(true); finish(answersRef.current); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = (colorId: string) => {
    if (completedRef.current || feedback !== null) return;
    const isCorrect = colorId === rounds[current].correctId;

    // ⚡ KRITIS: Update answersRef SEGERA (sebelum 350ms delay!)
    // Jika timer habis saat feedback window berjalan, finish() akan membaca
    // answersRef.current — harus sudah berisi jawaban ini, bukan jawaban sebelumnya.
    const newAnswers = [...answersRef.current, isCorrect];
    answersRef.current = newAnswers;

    setFeedback(isCorrect ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      setAnswers(newAnswers); // sinkron state untuk tampilan progress dots
      const next = newAnswers.length;
      if (next >= ROUNDS_PER_GAME) { setDone(true); finish(newAnswers); }
      else setCurrent(next);
    }, 350);
  };

  // Bug fix #3: tampilkan skor dari finalScoreRef jika tersedia, fallback ke state
  const displayCorrect = finalScoreRef.current?.correct ?? answers.filter(Boolean).length;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🎨 Color Match</p>
        <p className="text-5xl font-serif font-bold text-[#1F1D1B]">{displayCorrect * 10}</p>
        <p className="text-xs font-semibold text-[#78716C]">{displayCorrect}/{ROUNDS_PER_GAME} benar</p>
      </div>
    );
  }

  const round = rounds[current];

  return (
    <div className="flex flex-col gap-4 select-none">
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🎨 Color Match</p>
        <p className="mt-1 text-xs text-[#78716C]">
          Pilih <span className="text-[#C84B31] font-bold">WARNA TEKS</span>, bukan kata yang tertulis!
        </p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706] text-center">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#C84B31]">{current + 1}/{ROUNDS_PER_GAME}</span>
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

      {/* Progress dots */}
      <div className="flex gap-1">
        {rounds.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < answers.length
                ? answers[i] ? "bg-emerald-500" : "bg-red-500"
                : i === current ? "bg-[#C84B31]" : "bg-[#E7E5E4]"
            }`}
          />
        ))}
      </div>

      {/* Word display — Stroop effect */}
      <div
        className={`rounded-2xl border p-6 text-center transition-colors shadow-sm ${
          feedback === "correct" ? "border-emerald-200 bg-emerald-50"
          : feedback === "wrong" ? "border-red-200 bg-red-50"
          : "border-[#E7E5E4] bg-white"
        }`}
      >
        <p
          className="text-5xl font-black tracking-widest leading-tight"
          style={{ color: round.displayColor, textShadow: `0 0 20px ${round.displayColor}30` }}
        >
          {round.wordText}
        </p>
        <p className="text-[10px] text-[#78716C] mt-3 font-medium">
          ↑ Warna apa yang dipakai untuk menulis teks ini?
        </p>
        {feedback === "wrong" && (
          <p className="text-xs font-bold text-red-600 mt-2">
            ✗ Salah! ({round.correctId})
          </p>
        )}
        {feedback === "correct" && (
          <p className="text-xs font-bold text-emerald-600 mt-2">✓ Benar!</p>
        )}
      </div>

      {/* Color buttons — 6 opsi, BESAR dan jelas */}
      <div className="grid grid-cols-3 gap-2">
        {round.options.map(c => (
          <button
            key={c.id}
            onClick={() => handleAnswer(c.id)}
            disabled={feedback !== null}
            className="py-3 rounded-2xl border border-[#E7E5E4] bg-white shadow-2xs transition hover:border-[#D6D3D1] hover:bg-[#FCFBF7] active:scale-95 disabled:opacity-50 flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div
              className="w-7 h-7 rounded-full border border-black/5"
              style={{ backgroundColor: c.hex, boxShadow: `0 0 8px ${c.hex}40` }}
            />
            <span className="text-[11px] font-bold text-[#1F1D1B] capitalize">{c.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
