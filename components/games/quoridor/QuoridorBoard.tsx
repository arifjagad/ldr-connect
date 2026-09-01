"use client";

import { useState, useMemo, type ReactElement } from "react";
import type { QuoridorGameState, QuoridorWall } from "@/lib/types";
import {
  getValidMoves,
  isValidWallPlacement,
  BOARD_SIZE,
  type Position,
} from "@/lib/games/quoridor/helpers";

// ── Visual Constants ──────────────────────────────────────────────────────────
const CELL_SIZE  = 48; // px — cell size
const WALL_GAP   = 8;  // px — gap between cells for wall placement
const TOTAL_CELL = CELL_SIZE + WALL_GAP;

// ── Colors ────────────────────────────────────────────────────────────────────
const COLOR_HOST    = "#C84B31";  // Terracotta
const COLOR_PARTNER = "#4F46E5";  // Indigo

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

  // ── Cell Handlers ─────────────────────────────────────────────────────────
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

  // ── Gap Handlers ──────────────────────────────────────────────────────────
  function handleGapHClick(r: number, c: number) {
    if (disabled || !isMyTurn || mode !== "wall" || wallOrient !== "H") return;
    const wall: QuoridorWall = { orientation: "H", r, c };
    if (isValidWallPlacement(wall, gameState.walls, gameState.host_pos, gameState.partner_pos)) {
      onWall("H", r, c);
    }
  }

  function handleGapVClick(r: number, c: number) {
    if (disabled || !isMyTurn || mode !== "wall" || wallOrient !== "V") return;
    const wall: QuoridorWall = { orientation: "V", r, c };
    if (isValidWallPlacement(wall, gameState.walls, gameState.host_pos, gameState.partner_pos)) {
      onWall("V", r, c);
    }
  }

  // ── Wall Check ────────────────────────────────────────────────────────────
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

      cells.push(
        <div
          key={`cell-${r}-${c}`}
          style={{ width: CELL_SIZE, height: CELL_SIZE, cursor: canClick ? "pointer" : "default" }}
          className={[
            "relative flex items-center justify-center rounded-xl transition-all duration-150 border",
            isValidMove
              ? "bg-[#FDF4F2] border-[#FBDCD5] shadow-xs"
              : "bg-[#FCFBF7] border-[#E7E5E4]",
            isHovered && isValidMove ? "bg-[#FDF4F2] border-[#C84B31] scale-105" : "",
          ].join(" ")}
          onClick={() => handleCellClick(r, c)}
          onMouseEnter={() => handleCellHover(r, c)}
          onMouseLeave={() => setHoverCell(null)}
        >
          {/* Target row indicator — row 8 = Host goal (bottom) */}
          {r === BOARD_SIZE - 1 && (
            <div className="absolute inset-0 rounded-xl bg-linear-to-b from-transparent to-[#C84B31]/10 pointer-events-none" />
          )}
          {/* Target row indicator — row 0 = Partner goal (top) */}
          {r === 0 && (
            <div className="absolute inset-0 rounded-xl bg-linear-to-t from-transparent to-[#4F46E5]/10 pointer-events-none" />
          )}

          {/* Valid move indicator */}
          {isValidMove && !isHostHere && !isPartnerHere && (
            <div
              className="h-3 w-3 rounded-full animate-pulse"
              style={{ background: myRole === "host" ? COLOR_HOST : COLOR_PARTNER }}
            />
          )}

          {/* Host pawn */}
          {isHostHere && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md transition-all duration-300"
              style={{ background: COLOR_HOST }}
            >
              ♟
            </div>
          )}

          {/* Partner pawn */}
          {isPartnerHere && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md transition-all duration-300"
              style={{ background: COLOR_PARTNER }}
            >
              ♟
            </div>
          )}
        </div>
      );

      // Gap Vertical
      if (c < BOARD_SIZE - 1) {
        const wExists  = hasWallV(r, c);
        const isHover  = hoverWall?.orientation === "V" && hoverWall.c === c && (hoverWall.r === r || hoverWall.r === r - 1);

        cells.push(
          <div
            key={`gapV-${r}-${c}`}
            style={{ width: WALL_GAP, height: CELL_SIZE }}
            className={[
              "relative shrink-0 cursor-pointer transition-all duration-100",
              wExists ? "" : "hover:opacity-80",
            ].join(" ")}
            onClick={() => handleGapVClick(r, c)}
            onMouseEnter={() => {
              if (mode === "wall" && wallOrient === "V") setHoverWall({ orientation: "V", r, c });
            }}
            onMouseLeave={() => setHoverWall(null)}
          >
            {wExists && (
              <div className="absolute inset-0 rounded bg-[#D97706] shadow-xs" />
            )}
            {!wExists && isHover && isHoverWallValid && (
              <div
                className="absolute inset-0 rounded opacity-60"
                style={{ background: myRole === "host" ? COLOR_HOST : COLOR_PARTNER }}
              />
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

    // Gap Horizontal
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
              <div className="absolute inset-0 rounded bg-[#D97706] shadow-xs" />
            )}
            {!wExists && isHover && isHoverWallValid && (
              <div
                className="absolute inset-0 rounded opacity-60"
                style={{ background: myRole === "host" ? COLOR_HOST : COLOR_PARTNER }}
              />
            )}
          </div>
        );

        if (c < BOARD_SIZE - 1) {
          gapRow.push(
            <div
              key={`corner-${r}-${c}`}
              style={{ width: WALL_GAP, height: WALL_GAP }}
              className="shrink-0 rounded-xs bg-[#E7E5E4]"
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
      className="relative overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-xl shadow-black/2"
      style={{ width: boardPixels + 32, maxWidth: "100%" }}
    >
      {/* Target row labels */}
      <div className="mb-3 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider">
        <span style={{ color: COLOR_PARTNER }}>
          ← Tujuan {myRole === "partner" ? "Kamu" : "Partner"} (Atas)
        </span>
        <span style={{ color: COLOR_HOST }}>
          Tujuan {myRole === "host" ? "Kamu" : "Partner"} (Bawah) →
        </span>
      </div>

      {/* Board grid */}
      <div className="flex flex-col" style={{ gap: 0 }}>
        {rows}
      </div>

      {/* Overlay when not turn */}
      {(!isMyTurn || disabled) && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none" />
      )}
    </div>
  );
}
