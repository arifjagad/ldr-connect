"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  duration?: number;
  startedAt?: number;
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

interface MathProblem {
  text: string;
  answer: number;
  options: number[];
}

const QUESTIONS_PER_ROUND = 10;

function generateProblem(): MathProblem {
  const ops = ["+", "−", "×", "÷"] as const;
  const op  = ops[Math.floor(Math.random() * ops.length)];

  let a: number, b: number, answer: number, text: string;

  switch (op) {
    case "+":
      a = Math.floor(Math.random() * 80) + 10;
      b = Math.floor(Math.random() * 80) + 10;
      answer = a + b;
      text = `${a} + ${b}`;
      break;
    case "−":
      a = Math.floor(Math.random() * 80) + 30;
      b = Math.floor(Math.random() * (a - 5)) + 5;
      answer = a - b;
      text = `${a} − ${b}`;
      break;
    case "×":
      a = Math.floor(Math.random() * 11) + 2;
      b = Math.floor(Math.random() * 11) + 2;
      answer = a * b;
      text = `${a} × ${b}`;
      break;
    case "÷": {
      // Pastikan hasil bulat: pilih b lalu answer, hitung a = b × answer
      b = Math.floor(Math.random() * 10) + 2;
      answer = Math.floor(Math.random() * 12) + 2;
      a = b * answer;
      text = `${a} ÷ ${b}`;
      break;
    }
  }

  // 3 pengecoh yang masuk akal (tidak negatif, tidak duplikat)
  const wrongSet = new Set<number>();
  while (wrongSet.size < 3) {
    const delta = Math.floor(Math.random() * 15) + 1;
    const wrong = Math.random() > 0.5 ? answer + delta : Math.max(1, answer - delta);
    if (wrong !== answer && wrong > 0) wrongSet.add(wrong);
  }

  const options = [...wrongSet, answer].sort(() => Math.random() - 0.5);
  return { text, answer, options };
}

function generateProblems(n: number): MathProblem[] {
  return Array.from({ length: n }, () => generateProblem());
}

const GRACE_PERIOD_SECONDS = 2;

function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration + GRACE_PERIOD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
}

export function MathDashGame({ duration = 30, startedAt, bonusActive = false, onComplete }: Props) {
  const [problems]  = useState(() => generateProblems(QUESTIONS_PER_ROUND));
  const [current, setCurrent]   = useState(0);
  const [answers, setAnswers]   = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone]         = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => calcRemaining(duration, startedAt));

  // ── Refs anti-race-condition ───────────────────────────────────────────────
  const gameStartRef  = useRef(startedAt ?? Date.now());
  const completedRef  = useRef(false);
  const answersRef    = useRef<boolean[]>([]);
  const finalScoreRef = useRef<{ correct: number } | null>(null);

  // onCompleteRef — agar finish() TIDAK perlu onComplete sebagai dep
  // (mencegah countdown useEffect re-run & stale closure saat onComplete berubah)
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // finish — STABLE ([] deps), selalu baca dari refs, tidak pernah stale
  const finish = useCallback((ans: boolean[]) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    const correct   = ans.filter(Boolean).length;
    finalScoreRef.current = { correct };
    onCompleteRef.current(
      Math.round((correct / QUESTIONS_PER_ROUND) * 100),
      timeTaken,
      { correct, total: QUESTIONS_PER_ROUND },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown — hanya bergantung duration & startedAt (bukan finish)
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = calcRemaining(duration, startedAt);
      setTimeLeft(remaining);
      if (remaining === 0 && !completedRef.current) {
        clearInterval(id);
        setDone(true);
        finish(answersRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startedAt]);

  // Langsung timeout jika sudah habis saat mount
  useEffect(() => {
    if (calcRemaining(duration, startedAt) === 0) { setDone(true); finish(answersRef.current); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = (selected: number) => {
    if (completedRef.current || feedback !== null) return;
    const isCorrect = selected === problems[current].answer;
    // ⚡ Update ref SEGERA sebelum delay, agar countdown tidak baca data lama
    const newAnswers = [...answersRef.current, isCorrect];
    answersRef.current = newAnswers;
    setFeedback(isCorrect ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      setAnswers(newAnswers);
      const next = newAnswers.length;
      if (next >= QUESTIONS_PER_ROUND) { setDone(true); finish(newAnswers); }
      else setCurrent(next);
    }, 450);
  };

  const correctCount = finalScoreRef.current?.correct ?? answers.filter(Boolean).length;
  const urgent       = timeLeft <= 5;
  const timerPct     = duration > 0 ? (timeLeft / (duration + GRACE_PERIOD_SECONDS)) * 100 : 0;

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-sm font-medium text-[#9B93B0]">🔢 Math Dash</p>
        <p className="text-5xl font-bold text-[#FFF5F8]">{correctCount}/{QUESTIONS_PER_ROUND}</p>
        <p className="text-sm text-[#9B93B0]">jawaban benar</p>
        <div className="flex flex-wrap gap-1 justify-center mt-1">
          {answers.map((ok, i) => (
            <span key={i} className={`text-base ${ok ? "opacity-100" : "opacity-30"}`}>
              {ok ? "✅" : "❌"}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const problem = problems[current];

  // ── Playing screen ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 select-none">
      <div className="text-center">
        <p className="text-sm font-medium text-[#9B93B0]">🔢 Math Dash</p>
        <p className="mt-1 text-xs text-[#5C5470]">Jawab soal matematika secepat mungkin!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 text-xs font-bold text-yellow-400 text-center">
          +50 BONUS AKTIF!
        </div>
      )}

      {/* Counter + timer */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[#818CF8]">{current + 1}/{QUESTIONS_PER_ROUND}</span>
        <span className={`text-sm font-bold tabular-nums ${
          urgent ? "text-red-400 animate-pulse" : timeLeft <= 10 ? "text-yellow-400" : "text-[#FFF5F8]"
        }`}>
          {timeLeft}s
        </span>
      </div>

      {/* Timer bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${timerPct}%`,
            background: urgent
              ? "linear-gradient(90deg,#EF4444,#F97316)"
              : timeLeft <= 10
              ? "linear-gradient(90deg,#FBBF24,#F97316)"
              : "linear-gradient(90deg,#818CF8,#A78BFA)",
          }}
        />
      </div>

      {/* Progress dots */}
      <div className="flex gap-1">
        {problems.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i < answers.length
                ? answers[i] ? "bg-green-500" : "bg-red-500"
                : i === current ? "bg-[#818CF8]" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Problem card */}
      <div
        className={`rounded-2xl border p-6 text-center transition-all duration-200 ${
          feedback === "correct" ? "border-green-500/40 bg-green-500/10 scale-[1.01]"
          : feedback === "wrong"   ? "border-red-500/40 bg-red-500/10 scale-[0.99]"
          : "border-white/10 bg-white/5"
        }`}
      >
        <p className="text-4xl font-bold text-[#FFF5F8] tracking-wide">
          {problem.text} = <span className="text-[#818CF8]">?</span>
        </p>
        <div className="min-h-[24px] mt-2">
          {feedback && (
            <p className={`text-sm font-bold ${feedback === "correct" ? "text-green-400" : "text-red-400"}`}>
              {feedback === "correct" ? "✓ Benar!" : `✗ Salah! Jawabannya: ${problem.answer}`}
            </p>
          )}
        </div>
      </div>

      {/* Answer options */}
      <div className="grid grid-cols-2 gap-3">
        {problem.options.map((opt, i) => {
          const isSelected   = feedback !== null;
          const isCorrectOpt = opt === problem.answer;
          return (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              disabled={isSelected}
              className={`py-4 rounded-2xl border font-bold text-xl transition-all active:scale-95 ${
                isSelected && isCorrectOpt
                  ? "border-green-500/60 bg-green-500/15 text-green-300"
                  : isSelected && !isCorrectOpt
                  ? "border-white/5 bg-transparent text-[#5C5470]"
                  : "border-white/15 bg-white/5 text-[#FFF5F8] hover:border-[#818CF8]/40 hover:bg-[#818CF8]/10"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
