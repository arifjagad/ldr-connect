"use client";

interface DiceProps {
  value: number;      // 1-6, nilai dadu saat ini
  rolling: boolean;   // sedang animasi rolling
  disabled: boolean;
  onRoll: () => void;
}

const DOTS: Record<number, number[][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
};

export function Dice({ value, rolling, disabled, onRoll }: DiceProps) {
  const dots = DOTS[Math.max(1, Math.min(6, value))] ?? DOTS[1];

  return (
    <button
      onClick={onRoll}
      disabled={disabled}
      className={`group flex flex-col items-center gap-2 select-none transition-all duration-200 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110 active:scale-95"
      }`}
      title={disabled ? undefined : "Lempar dadu"}
    >
      <div
        className={`h-14 w-14 sm:h-20 sm:w-20 rounded-2xl border-2 bg-white shadow-lg ${
          rolling ? "animate-spin" : ""
        } ${
          disabled
            ? "border-white/20"
            : "border-white/80 shadow-[0_4px_20px_rgba(255,255,255,0.2)] group-hover:shadow-[0_4px_30px_rgba(255,255,255,0.35)]"
        }`}
        style={{ animationDuration: "0.3s" }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full p-2">
          {dots.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={8} fill="#1a1a2e" />
          ))}
        </svg>
      </div>
      <span className="text-[10px] font-medium whitespace-nowrap" style={{
        color: rolling ? "#FF6B9D" : disabled ? "transparent" : "#9B93B0"
      }}>
        {rolling ? "Rolling..." : "Klik lempar"}
      </span>
    </button>
  );
}
