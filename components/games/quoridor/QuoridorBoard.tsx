"use client";

import { useState, useMemo, type ReactElement } from "react";
import type { QuoridorGameState, QuoridorWall } from "@/lib/types";
import {
  getValidMoves,
  isValidWallPlacement,
  BOARD_SIZE,
  type Position,
} from "@/lib/games/quoridor/helpers";

// ── Konstanta Visual ──────────────────────────────────────────────────────────
const CELL_SIZE   = 52; // px — ukuran setiap sel
const WALL_GAP    = 8;  // px — celah antar sel (tempat tembok)
const TOTAL_CELL  = CELL_SIZE + WALL_GAP;

// ── Warna ─────────────────────────────────────────────────────────────────────
const COLOR_HOST    = "#FF3D7F";  // merah muda
const COLOR_PARTNER = "#818CF8";  // ungu

interface QuoridorBoardProps {
  gameState:   QuoridorGameState;
  myRole:      "host" | "partner";
  isMyTurn:    boolean;
  mode:        "move" | "wall";
  wallOrient:  "H" | "V";
  onMove:      (r: number, c: number) => void;
  onWall:      (orientation: "H" | "V", r: number, c: number) => void;
  disabled:    boolean;
}

export function QuoridorBoard({
  gameState,
  myRole,
  isMyTurn,
  mode,
  wallOrient,
  onMove,
  onWall,
  disabled,
}: QuoridorBoardProps) {
  const [hoverCell, setHoverCell] = useState<Position | null>(null);
  const [hoverWall, setHoverWall] = useState<QuoridorWall | null>(null);

  const myPos  = myRole === "host" ? gameState.host_pos    : gameState.partner_pos;
  const oppPos = myRole === "host" ? gameState.partner_pos : gameState.host_pos;

  const validMoves = useMemo(
    () =>
      isMyTurn && !disabled && mode === "move"
        ? getValidMoves(myPos, oppPos, gameState.walls)
        : [],
    [isMyTurn, disabled, mode, myPos, oppPos, gameState.walls]
  );

  const validMoveSet = useMemo(
    () => new Set(validMoves.map((p) => `${p.r},${p.c}`)),
    [validMoves]
  );

  const isHoverWallValid = useMemo(() => {
    if (!hoverWall || !isMyTurn || disabled || mode !== "wall") return false;
    return isValidWallPlacement(
      hoverWall,
      gameState.walls,
      gameState.host_pos,
      gameState.partner_pos
    );
  }, [hoverWall, isMyTurn, disabled, mode, gameState.walls, gameState.host_pos, gameState.partner_pos]);

  const boardPixels = BOARD_SIZE * CELL_SIZE + (BOARD_SIZE - 1) * WALL_GAP;

  // ── Handler sel ──────────────────────────────────────────────────────────────
  function handleCellClick(r: number, c: number) {
    if (disabled || !isMyTurn) return;
    if (mode === "move" && validMoveSet.has(`${r},${c}`)) {
      onMove(r, c);
    }
  }

  function handleCellHover(r: number, c: number) {
    setHoverCell({ r, c });
    if (mode === "wall") setHoverWall(null);
  }

  // ── Handler gap (area antar sel) untuk wall ───────────────────────────────
  // Gap H = antara baris r dan r+1 di kolom c
  function handleGapHClick(r: number, c: number) {
    if (disabled || !isMyTurn || mode !== "wall" || wallOrient !== "H") return;
    const wall: QuoridorWall = { orientation: "H", r, c };
    if (isValidWallPlacement(wall, gameState.walls, gameState.host_pos, gameState.partner_pos)) {
      onWall("H", r, c);
    }
  }

  // Gap V = antara kolom c dan c+1 di baris r
  function handleGapVClick(r: number, c: number) {
    if (disabled || !isMyTurn || mode !== "wall" || wallOrient !== "V") return;
    const wall: QuoridorWall = { orientation: "V", r, c };
    if (isValidWallPlacement(wall, gameState.walls, gameState.host_pos, gameState.partner_pos)) {
      onWall("V", r, c);
    }
  }

  // ── Cek apakah ada wall yang aktif ─────────────────────────────────────────
  function hasWallH(r: number, c: number): boolean {
    return gameState.walls.some(
      (w) => w.orientation === "H" && w.r === r && (w.c === c || w.c === c - 1)
    );
  }

  function hasWallV(r: number, c: number): boolean {
    return gameState.walls.some(
      (w) => w.orientation === "V" && w.c === c && (w.r === r || w.r === r - 1)
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const rows: ReactElement[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    const cells: ReactElement[] = [];

    for (let c = 0; c < BOARD_SIZE; c++) {
      const isHostHere    = gameState.host_pos.r === r    && gameState.host_pos.c === c;
      const isPartnerHere = gameState.partner_pos.r === r && gameState.partner_pos.c === c;
      const isValidMove   = validMoveSet.has(`${r},${c}`);
      const isHovered     = hoverCell?.r === r && hoverCell?.c === c;
      const canClick      = isMyTurn && !disabled && mode === "move" && isValidMove;

      // ── Sel ────────────────────────────────────────────────────────────────
      cells.push(
        <div
          key={`cell-${r}-${c}`}
          style={{ width: CELL_SIZE, height: CELL_SIZE, cursor: canClick ? "pointer" : "default" }}
          className={[
            "relative flex items-center justify-center rounded-lg transition-all duration-150",
            "border border-white/[0.07]",
            isValidMove
              ? "bg-white/10 border-white/20"
              : "bg-[#0D0D10]",
            isHovered && isValidMove ? "bg-white/20 scale-105" : "",
          ].join(" ")}
          onClick={() => handleCellClick(r, c)}
          onMouseEnter={() => handleCellHover(r, c)}
          onMouseLeave={() => setHoverCell(null)}
        >
          {/* Target row indicator — row 8 = tujuan HOST (bawah) */}
          {r === BOARD_SIZE - 1 && (
            <div className="absolute inset-0 rounded-lg opacity-30"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(255,61,127,0.15))" }} />
          )}
          {/* Target row indicator — row 0 = tujuan PARTNER (atas) */}
          {r === 0 && (
            <div className="absolute inset-0 rounded-lg opacity-30"
              style={{ background: "linear-gradient(to top, transparent, rgba(129,140,248,0.15))" }} />
          )}

          {/* Valid move indicator */}
          {isValidMove && !isHostHere && !isPartnerHere && (
            <div
              className="h-3 w-3 rounded-full opacity-60"
              style={{ background: myRole === "host" ? COLOR_HOST : COLOR_PARTNER }}
            />
          )}

          {/* Pion host */}
          {isHostHere && (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold shadow-lg transition-all duration-300"
              style={{
                background:  `linear-gradient(135deg, ${COLOR_HOST}, #FF6B9D)`,
                boxShadow:   `0 0 16px ${COLOR_HOST}60`,
                color:       "white",
                fontSize:    "18px",
              }}
            >
              ♟
            </div>
          )}

          {/* Pion partner */}
          {isPartnerHere && (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold shadow-lg transition-all duration-300"
              style={{
                background:  `linear-gradient(135deg, ${COLOR_PARTNER}, #A78BFA)`,
                boxShadow:   `0 0 16px ${COLOR_PARTNER}60`,
                color:       "white",
                fontSize:    "18px",
              }}
            >
              ♟
            </div>
          )}
        </div>
      );

      // ── Gap Vertikal (antara kolom c dan c+1) ─────────────────────────────
      if (c < BOARD_SIZE - 1) {
        const wExists  = hasWallV(r, c);
        const isHover  = hoverWall?.orientation === "V" && hoverWall.c === c && (hoverWall.r === r || hoverWall.r === r - 1);

        cells.push(
          <div
            key={`gapV-${r}-${c}`}
            style={{ width: WALL_GAP, height: CELL_SIZE }}
            className={[
              "relative flex-shrink-0 cursor-pointer transition-all duration-100",
              wExists  ? ""      : "hover:opacity-80",
            ].join(" ")}
            onClick={() => handleGapVClick(r, c)}
            onMouseEnter={() => {
              if (mode === "wall" && wallOrient === "V") setHoverWall({ orientation: "V", r, c });
            }}
            onMouseLeave={() => setHoverWall(null)}
          >
            {/* Existing wall */}
            {wExists && (
              <div className="absolute inset-0 rounded"
                style={{ background: "linear-gradient(to bottom, #FBBF24, #F59E0B)", boxShadow: "0 0 8px rgba(251,191,36,0.5)" }} />
            )}
            {/* Preview hover wall */}
            {!wExists && isHover && isHoverWallValid && (
              <div className="absolute inset-0 rounded opacity-60"
                style={{ background: myRole === "host" ? COLOR_HOST : COLOR_PARTNER }} />
            )}
          </div>
        );
      }
    }

    rows.push(
      <div key={`row-${r}`} className="flex" style={{ gap: 0 }}>
        {cells}
      </div>
    );

    // ── Gap Horizontal (antara baris r dan r+1) ─────────────────────────────
    if (r < BOARD_SIZE - 1) {
      const gapRow: ReactElement[] = [];

      for (let c = 0; c < BOARD_SIZE; c++) {
        const wExists = hasWallH(r, c);
        const isHover = hoverWall?.orientation === "H" && hoverWall.r === r && (hoverWall.c === c || hoverWall.c === c - 1);

        gapRow.push(
          <div
            key={`gapH-${r}-${c}`}
            style={{ width: CELL_SIZE, height: WALL_GAP }}
            className="relative cursor-pointer transition-all duration-100"
            onClick={() => handleGapHClick(r, c)}
            onMouseEnter={() => {
              if (mode === "wall" && wallOrient === "H") setHoverWall({ orientation: "H", r, c });
            }}
            onMouseLeave={() => setHoverWall(null)}
          >
            {wExists && (
              <div className="absolute inset-0 rounded"
                style={{ background: "linear-gradient(to right, #FBBF24, #F59E0B)", boxShadow: "0 0 8px rgba(251,191,36,0.5)" }} />
            )}
            {!wExists && isHover && isHoverWallValid && (
              <div className="absolute inset-0 rounded opacity-60"
                style={{ background: myRole === "host" ? COLOR_HOST : COLOR_PARTNER }} />
            )}
          </div>
        );

        // Corner dot antar gap
        if (c < BOARD_SIZE - 1) {
          gapRow.push(
            <div
              key={`corner-${r}-${c}`}
              style={{ width: WALL_GAP, height: WALL_GAP }}
              className="flex-shrink-0 rounded-sm bg-[#1a1a1f]"
            />
          );
        }
      }

      rows.push(
        <div key={`gapRow-${r}`} className="flex" style={{ gap: 0 }}>
          {gapRow}
        </div>
      );
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D10] p-4 shadow-[0_8px_48px_rgba(0,0,0,0.5)]"
      style={{ width: boardPixels + 32, maxWidth: "100%" }}
    >
      {/* Target row labels:
           Baris 0 (atas)  = tujuan Partner (warna ungu)
           Baris 8 (bawah) = tujuan Host (warna merah)
      */}
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-medium text-[#5C5470]">
        <span style={{ color: COLOR_PARTNER }}>
          ← Tujuan {myRole === "partner" ? "Kamu" : "Partner"}
        </span>
        <span style={{ color: COLOR_HOST }}>
          Tujuan {myRole === "host" ? "Kamu" : "Partner"} →
        </span>
      </div>

      {/* Board grid */}
      <div className="flex flex-col" style={{ gap: 0 }}>
        {rows}
      </div>

      {/* Overlay saat bukan giliran */}
      {(!isMyTurn || disabled) && (
        <div className="absolute inset-0 rounded-2xl" />
      )}
    </div>
  );
}
