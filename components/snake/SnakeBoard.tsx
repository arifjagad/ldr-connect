"use client";

import type { SnakeBoardConfig, SnakeGameState } from "@/lib/types";

interface SnakeBoardProps {
  boardConfig: SnakeBoardConfig;
  gameState: SnakeGameState;
  hostUserId: string;
  currentUserId: string;
}

/**
 * Konversi nomor kotak (1–100) ke posisi di grid board.
 * Board standar: 1 = bawah-kiri, 10 = bawah-kanan, zigzag naik ke 100 atas-kiri.
 * Koordinat dalam persen (0–100) relatif ke container.
 */
function squareToPercent(sq: number): { left: number; top: number } {
  const idx = sq - 1;              // 0-indexed
  const row = Math.floor(idx / 10); // 0 = baris paling bawah
  const col = row % 2 === 0
    ? idx % 10            // baris genap → kiri ke kanan
    : 9 - (idx % 10);    // baris ganjil → kanan ke kiri
  const visualRow = 9 - row;        // 0 = baris paling atas secara visual

  return {
    left: col * 10 + 5,     // center kotak (%)
    top:  visualRow * 10 + 5,
  };
}

function squareToSvg(sq: number): { x: number; y: number } {
  const p = squareToPercent(sq);
  return { x: p.left, y: p.top };
}

// ── Snake SVG (wavy line + kepala lingkaran) ───────────────────────────────
function SnakeSvg({ from, to, idx }: { from: number; to: number; idx: number }) {
  const head = squareToSvg(from);
  const tail = squareToSvg(to);

  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Vektor tegak-lurus (untuk gelombang)
  const nx = -dy / len;
  const ny =  dx / len;

  // Sinusoidal body pakai cubic bezier (4 segmen)
  const segments = 4;
  const amp = 2.2;
  let d = `M ${head.x.toFixed(2)} ${head.y.toFixed(2)}`;
  for (let i = 0; i < segments; i++) {
    const t1 = (i + 0.33) / segments;
    const t2 = (i + 0.67) / segments;
    const t3 = (i + 1) / segments;
    const sign = i % 2 === 0 ? 1 : -1;
    const c1x = (head.x + dx * t1 + nx * amp * sign).toFixed(2);
    const c1y = (head.y + dy * t1 + ny * amp * sign).toFixed(2);
    const c2x = (head.x + dx * t2 - nx * amp * sign).toFixed(2);
    const c2y = (head.y + dy * t2 - ny * amp * sign).toFixed(2);
    const ex  = (head.x + dx * t3).toFixed(2);
    const ey  = (head.y + dy * t3).toFixed(2);
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`;
  }

  const gid = `sg${idx}`;

  return (
    <g>
      <defs>
        <linearGradient id={gid} x1={head.x} y1={head.y} x2={tail.x} y2={tail.y} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF3D3D" />
          <stop offset="100%" stopColor="#7B1010" />
        </linearGradient>
      </defs>
      {/* Body */}
      <path d={d} stroke={`url(#${gid})`} strokeWidth="1.6" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
      {/* Kepala */}
      <circle cx={head.x} cy={head.y} r="2" fill="#FF3D3D" />
      <circle cx={head.x} cy={head.y} r="2" fill="none" stroke="#FF8080" strokeWidth="0.5" />
      {/* Mata kiri & kanan (offset kecil ke arah tegak lurus kepala→tail) */}
      <circle cx={(head.x + nx * 0.8 + dx / len * 0.5).toFixed(2)}
              cy={(head.y + ny * 0.8 + dy / len * 0.5).toFixed(2)}
              r="0.45" fill="white" />
      <circle cx={(head.x - nx * 0.8 + dx / len * 0.5).toFixed(2)}
              cy={(head.y - ny * 0.8 + dy / len * 0.5).toFixed(2)}
              r="0.45" fill="white" />
      {/* Ekor kecil */}
      <circle cx={tail.x} cy={tail.y} r="0.9" fill="#7B1010" opacity="0.7" />
    </g>
  );
}

// ── Ladder SVG (dua rel + anak tangga) ────────────────────────────────────
function LadderSvg({ from, to }: { from: number; to: number }) {
  const bot = squareToSvg(from);
  const top = squareToSvg(to);

  const dx = top.x - bot.x;
  const dy = top.y - bot.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Tegak lurus untuk lebar rel
  const nx = (-dy / len) * 1.2;
  const ny = ( dx / len) * 1.2;

  const lBot = { x: bot.x + nx, y: bot.y + ny };
  const lTop = { x: top.x + nx, y: top.y + ny };
  const rBot = { x: bot.x - nx, y: bot.y - ny };
  const rTop = { x: top.x - nx, y: top.y - ny };

  // Anak tangga (rungs)
  const numRungs = 5;
  const rungs = Array.from({ length: numRungs }, (_, i) => {
    const t = (i + 1) / (numRungs + 1);
    return {
      x1: (lBot.x + (lTop.x - lBot.x) * t).toFixed(2),
      y1: (lBot.y + (lTop.y - lBot.y) * t).toFixed(2),
      x2: (rBot.x + (rTop.x - rBot.x) * t).toFixed(2),
      y2: (rBot.y + (rTop.y - rBot.y) * t).toFixed(2),
    };
  });

  return (
    <g opacity="0.85">
      {/* Rel kiri */}
      <line x1={lBot.x.toFixed(2)} y1={lBot.y.toFixed(2)}
            x2={lTop.x.toFixed(2)} y2={lTop.y.toFixed(2)}
            stroke="#CD853F" strokeWidth="1.1" strokeLinecap="round" />
      {/* Rel kanan */}
      <line x1={rBot.x.toFixed(2)} y1={rBot.y.toFixed(2)}
            x2={rTop.x.toFixed(2)} y2={rTop.y.toFixed(2)}
            stroke="#CD853F" strokeWidth="1.1" strokeLinecap="round" />
      {/* Anak tangga */}
      {rungs.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
              stroke="#DAA520" strokeWidth="0.8" strokeLinecap="round" />
      ))}
      {/* Titik bawah & atas */}
      <circle cx={bot.x} cy={bot.y} r="1.3" fill="#22C55E" opacity="0.7" />
      <circle cx={top.x} cy={top.y} r="1.3" fill="#22C55E" opacity="0.4" />
    </g>
  );
}

// ── Warna kotak ──────────────────────────────────────────────────────────
function getCellStyle(sq: number, config: SnakeBoardConfig): React.CSSProperties {
  if (sq === 100) return { background: "linear-gradient(135deg, #FFD700, #FFA500)", border: "2px solid rgba(255,215,0,0.6)" };
  if (sq === 1)   return { background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.18)" };
  if (config.snakes.some((s) => s.from === sq))   return { background: "rgba(239,68,68,0.18)",  border: "1px solid rgba(239,68,68,0.4)" };
  if (config.ladders.some((l) => l.from === sq))  return { background: "rgba(34,197,94,0.18)",  border: "1px solid rgba(34,197,94,0.4)" };
  if (config.challenges.some((c) => c.square === sq)) return { background: "rgba(251,191,36,0.13)", border: "1px solid rgba(251,191,36,0.32)" };

  const idx = sq - 1;
  const row = Math.floor(idx / 10);
  const col = idx % 10;
  const isLight = (row + col) % 2 === 0;
  return {
    background: isLight ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.2)",
    border: "1px solid rgba(255,255,255,0.05)",
  };
}

// ── Build cell label ──────────────────────────────────────────────────────
function CellLabel({ sq }: { sq: number }) {
  if (sq === 100) return <span className="text-[7px] font-black text-yellow-300 leading-none">100</span>;
  if (sq === 1)   return <span className="text-[8px] font-bold text-[#9B93B0] leading-none">1</span>;
  return <span className="text-[7px] font-medium text-[#5C5470] leading-none">{sq}</span>;
}

// ── Main component ────────────────────────────────────────────────────────
export function SnakeBoard({ boardConfig, gameState, hostUserId, currentUserId }: SnakeBoardProps) {
  const myRole: "host" | "partner" = currentUserId === hostUserId ? "host" : "partner";

  const hostPos    = gameState.host_position;
  const partnerPos = gameState.partner_position;
  const hostPct    = hostPos    > 0 ? squareToPercent(hostPos)    : null;
  const partnerPct = partnerPos > 0 ? squareToPercent(partnerPos) : null;

  // ── Build 100 cells (grid: top row = visual row 0) ──────────────────────
  const cells: React.ReactNode[] = [];
  for (let row = 9; row >= 0; row--) {
    // row=9 → visual baris paling atas (squares 91–100)
    // row=0 → visual baris paling bawah (squares 1–10)
    const baseSquare = row * 10 + 1;
    const reversed   = row % 2 !== 0; // baris ganjil = kanan-ke-kiri

    for (let col = 0; col < 10; col++) {
      const sq = reversed ? baseSquare + (9 - col) : baseSquare + col;
      const style = getCellStyle(sq, boardConfig);
      const isChallenge = boardConfig.challenges.some((c) => c.square === sq);
      const chalType    = boardConfig.challenges.find((c) => c.square === sq)?.type;

      cells.push(
        <div key={sq} className="relative flex items-center justify-center overflow-hidden"
             style={{ ...style, aspectRatio: "1" }}>
          {/* Challenge icon */}
          {isChallenge && (
            <span className="absolute top-0.5 right-0.5 text-[7px]" title={chalType === "dare" ? "Dare!" : "Truth?"}>
              {chalType === "dare" ? "⚡" : "✦"}
            </span>
          )}
          {/* Snake head marker */}
          {boardConfig.snakes.some((s) => s.from === sq) && (
            <span className="absolute top-0.5 left-0.5 text-[7px]">🐍</span>
          )}
          {/* Ladder bottom marker */}
          {boardConfig.ladders.some((l) => l.from === sq) && (
            <span className="absolute top-0.5 left-0.5 text-[7px]">🪜</span>
          )}
          <CellLabel sq={sq} />
        </div>
      );
    }
  }

  return (
    <div className="relative w-full" style={{ maxWidth: 520 }}>
      {/* Board grid */}
      <div className="grid rounded-2xl overflow-hidden border border-white/10"
           style={{ gridTemplateColumns: "repeat(10, 1fr)", background: "#0d0d14" }}>
        {cells}
      </div>

      {/* SVG overlay: snakes & ladders */}
      <svg viewBox="0 0 100 100"
           className="absolute inset-0 w-full h-full pointer-events-none"
           style={{ top: 0, left: 0 }}
           preserveAspectRatio="none">
        {/* Ladders first (below snakes) */}
        {boardConfig.ladders.map((l, i) => (
          <LadderSvg key={`l${i}`} from={l.from} to={l.to} />
        ))}
        {/* Snakes on top */}
        {boardConfig.snakes.map((s, i) => (
          <SnakeSvg key={`s${i}`} from={s.from} to={s.to} idx={i} />
        ))}
      </svg>

      {/* Pion Host (pink) */}
      {hostPct && (
        <div className="absolute transition-all duration-500 ease-in-out pointer-events-none"
             style={{ left: `${hostPct.left}%`, top: `${hostPct.top}%`, transform: "translate(-50%, -50%)", zIndex: 10 }}>
          <div className="relative">
            <div className="h-5 w-5 rounded-full bg-[#FF3D7F] border-2 border-white shadow-[0_0_10px_rgba(255,61,127,0.9)] flex items-center justify-center">
              <span className="text-[7px] font-bold text-white">H</span>
            </div>
            {myRole === "host" && (
              <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-400 border border-white animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Pion Partner (indigo) */}
      {partnerPct && (
        <div className="absolute transition-all duration-500 ease-in-out pointer-events-none"
             style={{
               left: `${partnerPct.left + (hostPos === partnerPos ? 2 : 0)}%`,
               top:  `${partnerPct.top  + (hostPos === partnerPos ? 2 : 0)}%`,
               transform: "translate(-50%, -50%)",
               zIndex: 10,
             }}>
          <div className="relative">
            <div className="h-5 w-5 rounded-full bg-[#818CF8] border-2 border-white shadow-[0_0_10px_rgba(129,140,248,0.9)] flex items-center justify-center">
              <span className="text-[7px] font-bold text-white">P</span>
            </div>
            {myRole === "partner" && (
              <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-400 border border-white animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-[10px] text-[#5C5470]">
        <span className="flex items-center gap-1"><span>🐍</span> Kepala ular (turun)</span>
        <span className="flex items-center gap-1"><span>🪜</span> Bawah tangga (naik)</span>
        <span className="flex items-center gap-1"><span>⚡</span> Dare</span>
        <span className="flex items-center gap-1"><span>✦</span> Truth</span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF3D7F] inline-block" /> Host
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#818CF8] inline-block" /> Partner
        </span>
      </div>
    </div>
  );
}
