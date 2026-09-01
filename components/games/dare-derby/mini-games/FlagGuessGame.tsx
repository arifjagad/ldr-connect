"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  duration?: number;
  startedAt?: number;
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

interface FlagQuestion {
  code: string;
  country: string;
  options: string[];
}

// ── Semua negara yang tersedia di flagcdn.com ────────────────────────────────
// code = ISO 3166-1 alpha-2 lowercase
const ALL_FLAGS = [
  // Asia Tenggara
  { code: "id", country: "Indonesia" },
  { code: "my", country: "Malaysia" },
  { code: "sg", country: "Singapura" },
  { code: "ph", country: "Filipina" },
  { code: "th", country: "Thailand" },
  { code: "vn", country: "Vietnam" },
  { code: "mm", country: "Myanmar" },
  { code: "kh", country: "Kamboja" },
  { code: "la", country: "Laos" },
  { code: "bn", country: "Brunei Darussalam" },
  { code: "tl", country: "Timor-Leste" },
  // Asia Timur
  { code: "jp", country: "Jepang" },
  { code: "cn", country: "Tiongkok" },
  { code: "kr", country: "Korea Selatan" },
  { code: "kp", country: "Korea Utara" },
  { code: "mn", country: "Mongolia" },
  { code: "tw", country: "Taiwan" },
  // Asia Selatan
  { code: "in", country: "India" },
  { code: "pk", country: "Pakistan" },
  { code: "bd", country: "Bangladesh" },
  { code: "np", country: "Nepal" },
  { code: "lk", country: "Sri Lanka" },
  { code: "bt", country: "Bhutan" },
  { code: "mv", country: "Maladewa" },
  { code: "af", country: "Afghanistan" },
  // Asia Tengah
  { code: "kz", country: "Kazakhstan" },
  { code: "uz", country: "Uzbekistan" },
  { code: "tj", country: "Tajikistan" },
  { code: "kg", country: "Kyrgyzstan" },
  { code: "tm", country: "Turkmenistan" },
  // Timur Tengah
  { code: "sa", country: "Arab Saudi" },
  { code: "ae", country: "Uni Emirat Arab" },
  { code: "ir", country: "Iran" },
  { code: "iq", country: "Irak" },
  { code: "il", country: "Israel" },
  { code: "jo", country: "Yordania" },
  { code: "lb", country: "Lebanon" },
  { code: "sy", country: "Suriah" },
  { code: "ye", country: "Yaman" },
  { code: "om", country: "Oman" },
  { code: "kw", country: "Kuwait" },
  { code: "bh", country: "Bahrain" },
  { code: "qa", country: "Qatar" },
  { code: "tr", country: "Turki" },
  { code: "cy", country: "Siprus" },
  { code: "ge", country: "Georgia" },
  { code: "am", country: "Armenia" },
  { code: "az", country: "Azerbaijan" },
  // Eropa Barat
  { code: "gb", country: "Inggris" },
  { code: "fr", country: "Prancis" },
  { code: "de", country: "Jerman" },
  { code: "it", country: "Italia" },
  { code: "es", country: "Spanyol" },
  { code: "pt", country: "Portugal" },
  { code: "nl", country: "Belanda" },
  { code: "be", country: "Belgia" },
  { code: "ch", country: "Swiss" },
  { code: "at", country: "Austria" },
  { code: "ie", country: "Irlandia" },
  { code: "lu", country: "Luksemburg" },
  { code: "mc", country: "Monako" },
  { code: "ad", country: "Andorra" },
  { code: "li", country: "Liechtenstein" },
  { code: "sm", country: "San Marino" },
  { code: "mt", country: "Malta" },
  // Eropa Utara
  { code: "se", country: "Swedia" },
  { code: "no", country: "Norwegia" },
  { code: "dk", country: "Denmark" },
  { code: "fi", country: "Finlandia" },
  { code: "is", country: "Islandia" },
  { code: "ee", country: "Estonia" },
  { code: "lv", country: "Latvia" },
  { code: "lt", country: "Lithuania" },
  // Eropa Timur & Tengah
  { code: "pl", country: "Polandia" },
  { code: "cz", country: "Ceko" },
  { code: "sk", country: "Slovakia" },
  { code: "hu", country: "Hungaria" },
  { code: "ro", country: "Rumania" },
  { code: "bg", country: "Bulgaria" },
  { code: "ru", country: "Rusia" },
  { code: "ua", country: "Ukraina" },
  { code: "by", country: "Belarus" },
  { code: "md", country: "Moldova" },
  { code: "gr", country: "Yunani" },
  // Eropa Tenggara
  { code: "hr", country: "Kroasia" },
  { code: "rs", country: "Serbia" },
  { code: "ba", country: "Bosnia dan Herzegovina" },
  { code: "si", country: "Slovenia" },
  { code: "me", country: "Montenegro" },
  { code: "al", country: "Albania" },
  { code: "mk", country: "Makedonia Utara" },
  // Afrika Utara
  { code: "eg", country: "Mesir" },
  { code: "ma", country: "Maroko" },
  { code: "dz", country: "Aljazair" },
  { code: "tn", country: "Tunisia" },
  { code: "ly", country: "Libya" },
  { code: "sd", country: "Sudan" },
  // Afrika Barat
  { code: "ng", country: "Nigeria" },
  { code: "gh", country: "Ghana" },
  { code: "sn", country: "Senegal" },
  { code: "ci", country: "Pantai Gading" },
  { code: "cm", country: "Kamerun" },
  { code: "ml", country: "Mali" },
  { code: "gn", country: "Guinea" },
  { code: "bf", country: "Burkina Faso" },
  { code: "ne", country: "Niger" },
  { code: "tg", country: "Togo" },
  { code: "bj", country: "Benin" },
  { code: "lr", country: "Liberia" },
  { code: "sl", country: "Sierra Leone" },
  { code: "mr", country: "Mauritania" },
  { code: "gm", country: "Gambia" },
  { code: "gw", country: "Guinea-Bissau" },
  { code: "cv", country: "Tanjung Verde" },
  // Afrika Tengah
  { code: "cd", country: "Kongo (RDK)" },
  { code: "cg", country: "Kongo" },
  { code: "cf", country: "Republik Afrika Tengah" },
  { code: "td", country: "Chad" },
  { code: "ga", country: "Gabon" },
  { code: "gq", country: "Guinea Khatulistiwa" },
  { code: "ao", country: "Angola" },
  { code: "st", country: "Sao Tome dan Principe" },
  // Afrika Timur
  { code: "ke", country: "Kenya" },
  { code: "et", country: "Ethiopia" },
  { code: "tz", country: "Tanzania" },
  { code: "ug", country: "Uganda" },
  { code: "rw", country: "Rwanda" },
  { code: "bi", country: "Burundi" },
  { code: "so", country: "Somalia" },
  { code: "er", country: "Eritrea" },
  { code: "dj", country: "Djibouti" },
  { code: "ss", country: "Sudan Selatan" },
  { code: "km", country: "Komoro" },
  // Afrika Selatan
  { code: "za", country: "Afrika Selatan" },
  { code: "mz", country: "Mozambik" },
  { code: "zm", country: "Zambia" },
  { code: "zw", country: "Zimbabwe" },
  { code: "mw", country: "Malawi" },
  { code: "bw", country: "Botswana" },
  { code: "na", country: "Namibia" },
  { code: "mg", country: "Madagaskar" },
  { code: "sz", country: "Eswatini" },
  { code: "ls", country: "Lesotho" },
  { code: "mu", country: "Mauritius" },
  { code: "sc", country: "Seychelles" },
  // Amerika Utara & Tengah
  { code: "us", country: "Amerika Serikat" },
  { code: "ca", country: "Kanada" },
  { code: "mx", country: "Meksiko" },
  { code: "gt", country: "Guatemala" },
  { code: "bz", country: "Belize" },
  { code: "hn", country: "Honduras" },
  { code: "sv", country: "El Salvador" },
  { code: "ni", country: "Nikaragua" },
  { code: "cr", country: "Kosta Rika" },
  { code: "pa", country: "Panama" },
  // Karibia
  { code: "cu", country: "Kuba" },
  { code: "jm", country: "Jamaika" },
  { code: "ht", country: "Haiti" },
  { code: "do", country: "Republik Dominika" },
  { code: "tt", country: "Trinidad dan Tobago" },
  { code: "bb", country: "Barbados" },
  { code: "bs", country: "Bahama" },
  { code: "dm", country: "Dominika" },
  { code: "gd", country: "Grenada" },
  { code: "lc", country: "Saint Lucia" },
  { code: "vc", country: "Saint Vincent dan Grenadines" },
  { code: "ag", country: "Antigua dan Barbuda" },
  { code: "kn", country: "Saint Kitts dan Nevis" },
  // Amerika Selatan
  { code: "br", country: "Brasil" },
  { code: "ar", country: "Argentina" },
  { code: "cl", country: "Chili" },
  { code: "co", country: "Kolombia" },
  { code: "pe", country: "Peru" },
  { code: "ve", country: "Venezuela" },
  { code: "ec", country: "Ekuador" },
  { code: "bo", country: "Bolivia" },
  { code: "uy", country: "Uruguay" },
  { code: "py", country: "Paraguay" },
  { code: "gy", country: "Guyana" },
  { code: "sr", country: "Suriname" },
  // Oseania
  { code: "au", country: "Australia" },
  { code: "nz", country: "Selandia Baru" },
  { code: "pg", country: "Papua Nugini" },
  { code: "fj", country: "Fiji" },
  { code: "sb", country: "Kepulauan Solomon" },
  { code: "vu", country: "Vanuatu" },
  { code: "ws", country: "Samoa" },
  { code: "to", country: "Tonga" },
  { code: "ki", country: "Kiribati" },
  { code: "pw", country: "Palau" },
  { code: "mh", country: "Kepulauan Marshall" },
  { code: "fm", country: "Mikronesia" },
  { code: "nr", country: "Nauru" },
  { code: "tv", country: "Tuvalu" },
];

// 10 pertanyaan per ronde
const QUESTIONS_PER_ROUND = 10;

// SVG dari flagcdn.com — vector, SELALU tajam di semua resolusi & screen
function flagUrl(code: string) {
  return `https://flagcdn.com/${code}.svg`;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function generateQuestions(): FlagQuestion[] {
  const selected = pickRandom(ALL_FLAGS, QUESTIONS_PER_ROUND);
  return selected.map(flag => {
    const others = ALL_FLAGS.filter(f => f.country !== flag.country);
    const distractors = pickRandom(others, 3).map(f => f.country);
    const options = [...distractors, flag.country].sort(() => Math.random() - 0.5);
    return { code: flag.code, country: flag.country, options };
  });
}

// GRACE_PERIOD: buffer 2 detik untuk latency
const GRACE_PERIOD_SECONDS = 2;

function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration + GRACE_PERIOD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
}

export function FlagGuessGame({ duration = 60, startedAt, bonusActive = false, onComplete }: Props) {
  const [questions]  = useState(() => generateQuestions());
  const [current, setCurrent]   = useState(0);
  const [answers, setAnswers]   = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone]         = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => calcRemaining(duration, startedAt));
  // imgReady: true setelah gambar pertama selesai load (soal 2-10 sudah di-cache)
  const [imgReady, setImgReady] = useState(false);

  // ── Refs untuk mencegah race condition (stale closure) ────────────────────
  const gameStartRef  = useRef(startedAt ?? Date.now());
  const completedRef  = useRef(false);
  const answersRef    = useRef<boolean[]>([]);
  const finalScoreRef = useRef<{ correct: number } | null>(null);

  // onCompleteRef — agar finish() tidak perlu onComplete sebagai dep
  // (mencegah countdown useEffect re-run saat onComplete berubah)
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // finish — STABLE ([] deps), selalu baca dari refs
  const finish = useCallback((ans: boolean[]) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    const correct = ans.filter(Boolean).length;
    finalScoreRef.current = { correct };
    onCompleteRef.current(
      Math.round((correct / QUESTIONS_PER_ROUND) * 100),
      timeTaken,
      { correct, total: QUESTIONS_PER_ROUND },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown — tidak bergantung pada finish (finish sudah stable)
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

  // ⚡ Preload SEMUA 10 bendera sekaligus saat mount
  // Soal 2-10 sudah ada di browser cache sebelum user selesai soal pertama
  useEffect(() => {
    let firstLoaded = false;
    questions.forEach((q, idx) => {
      const img = new Image();
      img.src = flagUrl(q.code);
      if (idx === 0) {
        img.onload  = () => { if (!firstLoaded) { firstLoaded = true; setImgReady(true); } };
        img.onerror = () => { if (!firstLoaded) { firstLoaded = true; setImgReady(true); } };
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = (selected: string) => {
    if (completedRef.current || feedback !== null) return;
    const isCorrect = selected === questions[current].country;
    // ⚡ Update ref SEGERA sebelum 700ms delay
    const newAnswers = [...answersRef.current, isCorrect];
    answersRef.current = newAnswers;
    setFeedback(isCorrect ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      setAnswers(newAnswers);
      const next = newAnswers.length;
      if (next >= QUESTIONS_PER_ROUND) { setDone(true); finish(newAnswers); }
      else setCurrent(next);
    }, 700);
  };

  const correctCount = finalScoreRef.current?.correct ?? answers.filter(Boolean).length;
  const urgent       = timeLeft <= 5;
  const timerPct     = duration > 0 ? (timeLeft / (duration + GRACE_PERIOD_SECONDS)) * 100 : 0;

  // ── Done screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🏳️ Tebak Bendera</p>
        <p className="text-5xl font-serif font-bold text-[#1F1D1B]">{correctCount}/{QUESTIONS_PER_ROUND}</p>
        <p className="text-xs font-semibold text-[#78716C]">tebakan benar</p>
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

  const q = questions[current];

  // ── Playing screen ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 select-none">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🏳️ Tebak Bendera</p>
        <p className="mt-1 text-xs text-[#78716C]">Negara mana yang memiliki bendera ini?</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706] text-center">
          +50 BONUS AKTIF!
        </div>
      )}

      {/* Counter + timer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#C84B31]">{current + 1}/{QUESTIONS_PER_ROUND}</span>
        <span className={`text-sm font-bold tabular-nums ${
          urgent ? "text-red-500 animate-pulse" : timeLeft <= 10 ? "text-[#D97706]" : "text-[#1F1D1B]"
        }`}>
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

      {/* Progress dots */}
      <div className="flex gap-1">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i < answers.length
                ? answers[i] ? "bg-emerald-500" : "bg-red-500"
                : i === current ? "bg-[#C84B31]" : "bg-[#E7E5E4]"
            }`}
          />
        ))}
      </div>

      {/* Flag display */}
      <div
        className={`rounded-2xl border overflow-hidden transition-all duration-200 shadow-sm ${
          feedback === "correct" ? "border-emerald-200 bg-emerald-50 scale-[1.01]"
          : feedback === "wrong"   ? "border-red-200 bg-red-50 scale-[0.99]"
          : "border-[#E7E5E4] bg-white"
        }`}
      >
        {/* Gambar bendera — SVG, tajam sempurna di semua resolusi */}
        <div className="flex items-center justify-center py-5 px-6 min-h-[130px] bg-[#FCFBF7]">
          {!imgReady ? (
            <div className="w-[190px] h-[120px] rounded-lg bg-[#E7E5E4] animate-pulse" />
          ) : (
            <img
              key={q.code}
              src={flagUrl(q.code)}
              alt={`Bendera ${q.country}`}
              className="rounded-md shadow-md border border-black/5"
              style={{
                maxHeight: 120,
                maxWidth: 200,
                width: "100%",
                objectFit: "contain",
              }}
            />
          )}
        </div>

        {/* Feedback */}
        <div className="text-center pb-3 min-h-[26px]">
          {feedback === "wrong" && (
            <p className="text-xs font-bold text-red-600">✗ Salah! Jawabannya: {q.country}</p>
          )}
          {feedback === "correct" && (
            <p className="text-xs font-bold text-emerald-600">✓ Benar!</p>
          )}
        </div>
      </div>

      {/* Answer options — 2x2 grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {q.options.map((opt, i) => {
          const isSelected  = feedback !== null;
          const isCorrectOpt = opt === q.country;
          return (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              disabled={isSelected}
              className={`py-3 px-2 rounded-xl border text-xs font-bold transition-all active:scale-95 leading-tight cursor-pointer shadow-2xs ${
                isSelected && isCorrectOpt
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : isSelected && !isCorrectOpt
                  ? "border-[#E7E5E4] bg-[#FCFBF7] text-[#A8A29E]"
                  : "border-[#E7E5E4] bg-white text-[#1F1D1B] hover:border-[#C84B31] hover:bg-[#FDF4F2]"
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
