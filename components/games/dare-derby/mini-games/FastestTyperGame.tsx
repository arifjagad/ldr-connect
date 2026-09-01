"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  duration?: number;
  startedAt?: number;
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

// ── Pool kalimat — panjang & rawan typo saat diketik cepat ──────────────────
const ALL_SENTENCES = [
  "kamu adalah alasan mengapa aku selalu bersemangat menjalani hari",
  "meskipun jarak memisahkan kita cintaku tidak pernah berkurang sedikitpun",
  "setiap pesan darimu membuatku tersenyum dan melupakan semua kelelahan",
  "aku berjanji akan selalu ada untukmu dalam setiap suka maupun duka",
  "kehadiranmu dalam hidupku adalah berkah yang tidak ternilai harganya",
  "aku ingin menulis namamu di setiap halaman cerita hidupku",
  "kamu telah mengubah caraku memandang dunia menjadi jauh lebih indah",
  "malam ini aku rindu suaramu lebih dari biasanya",
  "bersama kamu setiap detik terasa seperti keajaiban yang nyata",
  "terima kasih sudah memilihku di antara semua pilihan yang ada",
  "peluk virtual dariku semoga bisa menghangatkan malammu yang dingin",
  "hatiku selalu berdetak lebih kencang setiap kali melihat namamu muncul",
  "tidak ada yang lebih aku inginkan selain menghabiskan waktu bersamamu",
  "kamu membuktikan bahwa cinta jarak jauh bisa bertahan dan menguat",
  "setiap foto kita bersama menjadi semangat untuk terus melangkah",
  "aku tidak sabar menunggu hari saat kita bisa bertemu kembali",
  "kamu adalah prioritas utama dalam setiap doa dan harapanku",
  "perasaanku padamu semakin tumbuh meskipun kita tidak selalu bersama",
  "mencintaimu adalah keputusan terbaik yang pernah aku ambil dalam hidup",
  "suatu hari nanti kita akan ketawa bersama mengingat perjuangan ini",
  "kerinduan yang dalam selalu mengingatkanku pada tawa dan pelukmu",
  "persahabatan kita berkembang menjadi cinta yang sungguh mengagumkan",
  "kebersamaan adalah kebahagiaan paling murni yang pernah kurasakan bersamamu",
  "aku selalu memikirkanmu ketika langit mulai berwarna jingga dan ungu",
  "setiap lagu yang kudengar membawa ingatanku langsung kepadamu sayang",
  "kamu membuat kesepianku berubah menjadi kehangatan yang luar biasa",
  "dalam setiap kesulitan kamu selalu menjadi kekuatanku yang terbesar",
  "aku bangga dengan seberapa jauh kita sudah berjalan bersama hingga kini",
  "tidak ada kata yang cukup untuk menggambarkan betapa berartinya kamu",
  "kamu hadir mengisi kekosongan yang selama ini tidak kusadari ada",
  "bersamamu semua permasalahan terasa jauh lebih ringan dan mudah dihadapi",
  "aku bersyukur kepada semesta karena mempertemukanku denganmu di waktu yang tepat",
  "komunikasi kita yang terbuka membuktikan bahwa kepercayaan adalah fondasi segalanya",
  "meskipun terkadang salah paham hadir cinta kita selalu berhasil mengatasinya",
  "aku memilihmu setiap hari bukan karena terpaksa melainkan karena aku ingin",
];

// 5 kalimat per game, masing-masing bernilai maks 20 poin → total maks 100
const SENTENCES_PER_ROUND   = 5;
const MAX_PER_SENTENCE      = 20; // 20 poin per kalimat
const GRACE_PERIOD_SECONDS  = 2;

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration + GRACE_PERIOD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
}

/**
 * Hitung skor satu kalimat (0–20).
 * Setiap 5% akurasi = 1 poin.
 * Akurasi dihitung dari karakter yg posisinya tepat / panjang target.
 */
function calcSentenceScore(typed: string, target: string): number {
  const t = target.toLowerCase();
  const s = typed.trim().toLowerCase();
  if (s === t) return MAX_PER_SENTENCE;
  let correct = 0;
  for (let i = 0; i < Math.min(s.length, t.length); i++) {
    if (s[i] === t[i]) correct++;
  }
  const pct = t.length > 0 ? (correct / t.length) * 100 : 0;
  return Math.min(MAX_PER_SENTENCE, Math.floor(pct / 5));
}

export function FastestTyperGame({ duration = 60, startedAt, bonusActive = false, onComplete }: Props) {
  const [sentences]   = useState(() => pickRandom(ALL_SENTENCES, SENTENCES_PER_ROUND));
  const [current, setCurrent]   = useState(0);
  const [input, setInput]       = useState("");
  const [sentenceScores, setSentenceScores] = useState<number[]>(Array(SENTENCES_PER_ROUND).fill(0));
  const [status, setStatus]     = useState<("exact" | "partial" | "wrong" | null)[]>(Array(SENTENCES_PER_ROUND).fill(null));
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone]         = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => calcRemaining(duration, startedAt));

  // ── Refs: single source of truth untuk semua async path ─────────────────────
  const completedRef   = useRef(false);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStartRef   = useRef(startedAt ?? Date.now());
  const inputElRef     = useRef<HTMLInputElement>(null);

  // Refs yang di-sync real-time agar tidak ada stale closure
  const scoresRef    = useRef<number[]>(Array(SENTENCES_PER_ROUND).fill(0));
  const currentRef   = useRef(0);
  const inputValRef  = useRef("");    // nilai input sekarang
  const sentencesRef = useRef(sentences);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { currentRef.current  = current; }, [current]);
  useEffect(() => { inputValRef.current = input;   }, [input]);

  // ── finish() — satu-satunya jalur ke onComplete, baca dari refs ─────────────
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    // Skor final dari ref (sudah diupdate inline setiap submit)
    const finalScores = [...scoresRef.current];

    // Jika timer habis saat sedang mengetik kalimat saat ini → skor partial
    const idx = currentRef.current;
    if (finalScores[idx] === 0 && inputValRef.current.trim().length > 0) {
      finalScores[idx] = calcSentenceScore(inputValRef.current, sentencesRef.current[idx]);
    }

    const total     = finalScores.reduce((a, b) => a + b, 0); // 0–100
    const timeTaken = Date.now() - gameStartRef.current;
    onComplete(total, timeTaken, {
      scores:         finalScores,
      total_possible: SENTENCES_PER_ROUND * MAX_PER_SENTENCE,
    });
  }, [onComplete]);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = calcRemaining(duration, startedAt);
      setTimeLeft(remaining);
      if (remaining === 0 && !completedRef.current) {
        clearInterval(id);
        intervalRef.current = null;
        setDone(true);
        finish();
      }
    }, 250);
    intervalRef.current = id;
    return () => { clearInterval(id); intervalRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startedAt, finish]);

  // Langsung timeout jika sudah habis saat mount
  useEffect(() => {
    if (calcRemaining(duration, startedAt) === 0) { setDone(true); finish(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus on mount & pindah kalimat
  useEffect(() => { inputElRef.current?.focus(); }, []);
  useEffect(() => { if (!done) inputElRef.current?.focus(); }, [current, done]);

  // ── submitSentence — fungsi murni tanpa useCallback, baca dari refs ─────────
  function submitSentence(typedVal: string, sentenceIdx: number) {
    if (completedRef.current || feedback !== null) return;

    const target   = sentencesRef.current[sentenceIdx];
    const score    = calcSentenceScore(typedVal, target);
    const isExact  = typedVal.trim().toLowerCase() === target.toLowerCase();

    // ⚡ Update refs SEGERA — sebelum apapun yang async
    const newScores = [...scoresRef.current];
    newScores[sentenceIdx] = score;
    scoresRef.current = newScores;

    // Update display state
    setSentenceScores([...newScores]);
    setStatus(prev => {
      const n = [...prev];
      n[sentenceIdx] = isExact ? "exact" : score > 0 ? "partial" : "wrong";
      return n;
    });

    setFeedback(isExact ? "correct" : "wrong");

    setTimeout(() => {
      setFeedback(null);
      setInput("");
      inputValRef.current = "";
      const next = sentenceIdx + 1;
      if (next >= SENTENCES_PER_ROUND) {
        setDone(true);
        finish();
      } else {
        setCurrent(next);
        currentRef.current = next;
      }
    }, 400);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalScore  = sentenceScores.reduce((a, b) => a + b, 0);
  const timerPct    = duration > 0 ? (timeLeft / (duration + GRACE_PERIOD_SECONDS)) * 100 : 0;
  const urgent      = timeLeft <= 5;

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">⌨️ Ketik Cepat</p>
        <p className="text-5xl font-serif font-bold text-[#1F1D1B]">{totalScore}</p>
        <p className="text-xs font-semibold text-[#78716C]">dari {SENTENCES_PER_ROUND * MAX_PER_SENTENCE} poin</p>
        <div className="flex gap-1.5 mt-1">
          {sentenceScores.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: s === MAX_PER_SENTENCE ? "#EBF9EB"
                    : s > 0 ? "#FEF3C7" : "#FEF2F2",
                  color: s === MAX_PER_SENTENCE ? "#10B981" : s > 0 ? "#D97706" : "#EF4444",
                }}
              >
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentSentence = sentences[current];

  // Render huruf per huruf dengan highlight real-time
  const renderLetters = () =>
    currentSentence.split("").map((char, i) => {
      let color = "text-[#A8A29E]";
      if (i < input.length) {
        color = input[i]?.toLowerCase() === char.toLowerCase() ? "text-emerald-600 font-bold" : "text-red-500 font-bold";
      } else if (i === input.length) {
        color = "text-[#1F1D1B] font-bold";
      }
      return (
        <span
          key={i}
          className={`font-semibold transition-colors duration-75 ${color} ${char === " " ? "mx-0.5" : ""}`}
          style={{ fontSize: "1.05rem", letterSpacing: "0.02em" }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      );
    });

  // ── Playing screen ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 select-none">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">⌨️ Ketik Cepat</p>
        <p className="mt-1 text-xs text-[#78716C]">
          Ketik kalimat di bawah — skor berdasarkan akurasi karakter!
        </p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706] text-center">
          +50 BONUS AKTIF!
        </div>
      )}

      {/* Round counter + score + timer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#C84B31]">{current + 1}/{SENTENCES_PER_ROUND}</span>
        <span className="text-xs font-semibold text-[#78716C]">
          Poin: <span className="text-[#1F1D1B] font-bold">{totalScore}</span>/{SENTENCES_PER_ROUND * MAX_PER_SENTENCE}
        </span>
        <span className={`text-sm font-bold tabular-nums ${urgent ? "text-red-500 animate-pulse" : timeLeft <= 10 ? "text-[#D97706]" : "text-[#1F1D1B]"}`}>
          {timeLeft}s
        </span>
      </div>

      {/* Timer bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E7E5E4]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${timerPct}%`,
            background: urgent
              ? "#EF4444"
              : timeLeft <= 10
              ? "#D97706"
              : "#C84B31",
          }}
        />
      </div>

      {/* Progress dots — warna berdasarkan skor */}
      <div className="flex gap-1.5">
        {sentenceScores.map((s, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all"
            style={{
              background:
                status[i] === "exact"   ? "#10B981"
                : status[i] === "partial" ? "#D97706"
                : status[i] === "wrong"   ? "#EF4444"
                : i === current           ? "#C84B31"
                : "#E7E5E4",
            }}
          />
        ))}
      </div>

      {/* Sentence card */}
      <div
        className={`rounded-2xl border p-4 text-center transition-all duration-200 shadow-sm ${
          feedback === "correct" ? "border-emerald-200 bg-emerald-50 scale-[1.01]"
          : feedback === "wrong"   ? "border-amber-200 bg-amber-50 scale-[0.99]"
          : "border-[#E7E5E4] bg-white"
        }`}
      >
        <div className="flex justify-center flex-wrap gap-0 leading-relaxed min-h-[3rem] items-center">
          {renderLetters()}
        </div>

        {/* Status hint */}
        <div className="mt-2 h-5">
          {feedback === "correct" && <p className="text-xs font-bold text-emerald-600">✓ Sempurna! +{MAX_PER_SENTENCE}</p>}
          {feedback === "wrong"   && <p className="text-xs font-bold text-[#D97706]">✗ Lanjut!</p>}
          {feedback === null && (
            <p className="text-[10px] text-[#78716C] font-medium">
              {input.length} / {currentSentence.length} karakter
            </p>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="w-full flex flex-col gap-3">
        <input
          ref={inputElRef}
          value={input}
          onChange={e => {
            if (feedback || completedRef.current) return;
            const val = e.target.value;
            setInput(val);
            inputValRef.current = val; // ⚡ sync ref SEGERA

            // Auto-submit saat tepat (inline — currentRef fresh, tidak ada stale closure)
            if (
              val.trim().length > 0 &&
              val.trim().toLowerCase() === sentencesRef.current[currentRef.current]?.toLowerCase()
            ) {
              submitSentence(val, currentRef.current);
            }
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !feedback && !completedRef.current && input.trim().length > 0) {
              submitSentence(input, currentRef.current);
            }
          }}
          placeholder="Ketik kalimat di atas..."
          className={`w-full rounded-xl border px-4 py-3 text-center text-sm font-medium outline-none transition ${
            feedback === "correct" ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : feedback === "wrong"  ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-[#E7E5E4] bg-[#FCFBF7] text-[#1F1D1B] focus:border-[#C84B31] focus:bg-white focus:ring-2 focus:ring-[#C84B31]/10"
          }`}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={feedback !== null}
        />
        <button
          onClick={() => {
            if (!feedback && !completedRef.current && input.trim().length > 0) {
              submitSentence(input, currentRef.current);
            }
          }}
          disabled={feedback !== null || input.trim().length === 0}
          className="w-full py-3 rounded-xl bg-[#C84B31] hover:bg-[#B33E26] text-white font-semibold text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
        >
          Kirim ↵
        </button>
      </div>
    </div>
  );
}
