import type { QuoridorWall } from "@/lib/types";

export const BOARD_SIZE = 9;

// ── Types Lokal ───────────────────────────────────────────────────────────────
export interface Position { r: number; c: number; }

// ── Wall Blocking Helpers ─────────────────────────────────────────────────────

/**
 * Cek apakah ada tembok Horizontal yang menghalangi pergerakan
 * dari baris `r` ke baris `r+1` di kolom `c`
 */
export function isBlockedDown(r: number, c: number, walls: QuoridorWall[]): boolean {
  return walls.some(
    (w) =>
      w.orientation === "H" &&
      w.r === r &&
      (w.c === c || w.c === c - 1)
  );
}

/**
 * Cek apakah ada tembok yang menghalangi pergerakan
 * dari baris `r` ke baris `r-1` di kolom `c`
 */
export function isBlockedUp(r: number, c: number, walls: QuoridorWall[]): boolean {
  return walls.some(
    (w) =>
      w.orientation === "H" &&
      w.r === r - 1 &&
      (w.c === c || w.c === c - 1)
  );
}

/**
 * Cek apakah ada tembok Vertikal yang menghalangi pergerakan
 * dari kolom `c` ke kolom `c+1` di baris `r`
 */
export function isBlockedRight(r: number, c: number, walls: QuoridorWall[]): boolean {
  return walls.some(
    (w) =>
      w.orientation === "V" &&
      w.c === c &&
      (w.r === r || w.r === r - 1)
  );
}

/**
 * Cek apakah ada tembok yang menghalangi pergerakan
 * dari kolom `c` ke kolom `c-1` di baris `r`
 */
export function isBlockedLeft(r: number, c: number, walls: QuoridorWall[]): boolean {
  return walls.some(
    (w) =>
      w.orientation === "V" &&
      w.c === c - 1 &&
      (w.r === r || w.r === r - 1)
  );
}

// ── BFS Pathfinding ───────────────────────────────────────────────────────────

/**
 * BFS untuk mengecek apakah ada jalur dari `startPos` ke `targetRow`.
 * Digunakan untuk memvalidasi bahwa wall placement tidak memblokir total jalur pemain.
 */
export function hasPath(
  startPos:  Position,
  targetRow: number,
  walls:     QuoridorWall[]
): boolean {
  const visited = new Set<string>();
  const queue: Position[] = [startPos];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const key = `${curr.r},${curr.c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (curr.r === targetRow) return true;

    const { r, c } = curr;

    // Atas
    if (r > 0 && !isBlockedUp(r, c, walls))
      queue.push({ r: r - 1, c });
    // Bawah
    if (r < BOARD_SIZE - 1 && !isBlockedDown(r, c, walls))
      queue.push({ r: r + 1, c });
    // Kiri
    if (c > 0 && !isBlockedLeft(r, c, walls))
      queue.push({ r, c: c - 1 });
    // Kanan
    if (c < BOARD_SIZE - 1 && !isBlockedRight(r, c, walls))
      queue.push({ r, c: c + 1 });
  }

  return false;
}

// ── Valid Moves ───────────────────────────────────────────────────────────────

/**
 * Hitung semua posisi yang bisa dituju dari `myPos`.
 * Aturan Quoridor lengkap:
 * - Gerak 1 langkah (atas/bawah/kiri/kanan), tidak melewati tembok
 * - Jika posisi tujuan ditempati lawan, coba lompati (jump over):
 *   - Jika jalur lanjut dari lawan tidak diblokir tembok & masih di dalam board → lompat
 *   - Jika jalur lompatan diblokir / di luar board → bisa gerak diagonal (2 arah)
 */
export function getValidMoves(
  myPos:  Position,
  oppPos: Position,
  walls:  QuoridorWall[]
): Position[] {
  const moves: Position[] = [];
  const { r, c } = myPos;

  function inBounds(nr: number, nc: number) {
    return nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE;
  }

  function addIfValid(nr: number, nc: number) {
    if (inBounds(nr, nc) && !(nr === oppPos.r && nc === oppPos.c)) {
      moves.push({ r: nr, c: nc });
    }
  }

  // ── Coba 4 arah dari posisi saya ──
  const directions: Array<{
    dr: number; dc: number;
    blocked: (r: number, c: number) => boolean;
    // Untuk lompatan di atas lawan, arah perpendicular
    perp: Array<{ dr: number; dc: number; blocked: (r: number, c: number) => boolean }>;
  }> = [
    {
      dr: -1, dc: 0,
      blocked: (r, c) => isBlockedUp(r, c, walls),
      perp: [
        { dr: 0, dc: -1, blocked: (r, c) => isBlockedLeft(r, c, walls) },
        { dr: 0, dc:  1, blocked: (r, c) => isBlockedRight(r, c, walls) },
      ],
    },
    {
      dr:  1, dc: 0,
      blocked: (r, c) => isBlockedDown(r, c, walls),
      perp: [
        { dr: 0, dc: -1, blocked: (r, c) => isBlockedLeft(r, c, walls) },
        { dr: 0, dc:  1, blocked: (r, c) => isBlockedRight(r, c, walls) },
      ],
    },
    {
      dr: 0, dc: -1,
      blocked: (r, c) => isBlockedLeft(r, c, walls),
      perp: [
        { dr: -1, dc: 0, blocked: (r, c) => isBlockedUp(r, c, walls) },
        { dr:  1, dc: 0, blocked: (r, c) => isBlockedDown(r, c, walls) },
      ],
    },
    {
      dr: 0, dc:  1,
      blocked: (r, c) => isBlockedRight(r, c, walls),
      perp: [
        { dr: -1, dc: 0, blocked: (r, c) => isBlockedUp(r, c, walls) },
        { dr:  1, dc: 0, blocked: (r, c) => isBlockedDown(r, c, walls) },
      ],
    },
  ];

  for (const dir of directions) {
    const nr = r + dir.dr;
    const nc = c + dir.dc;

    if (!inBounds(nr, nc)) continue;
    if (dir.blocked(r, c)) continue; // wall menghalangi langkah ke arah ini

    // Arah bisa dituju, tapi ada lawan di sini?
    if (nr === oppPos.r && nc === oppPos.c) {
      // Coba lompat di atas lawan (jump straight)
      const jr = nr + dir.dr;
      const jc = nc + dir.dc;
      const canJumpStraight =
        inBounds(jr, jc) && !dir.blocked(nr, nc);

      if (canJumpStraight) {
        addIfValid(jr, jc);
      } else {
        // Lompatan lurus tidak bisa → coba diagonal (dua sisi)
        for (const perp of dir.perp) {
          const pr = nr + perp.dr;
          const pc = nc + perp.dc;
          if (inBounds(pr, pc) && !perp.blocked(nr, nc)) {
            addIfValid(pr, pc);
          }
        }
      }
    } else {
      // Tidak ada lawan di sini, tambahkan sebagai valid move
      moves.push({ r: nr, c: nc });
    }
  }

  return moves;
}


// ── Valid Walls ───────────────────────────────────────────────────────────────

/**
 * Cek apakah sebuah wall placement valid:
 * - Tidak overlap dengan wall yang sudah ada
 * - Tidak memblokir total jalur host maupun partner (BFS check)
 */
export function isValidWallPlacement(
  newWall:    QuoridorWall,
  existingWalls: QuoridorWall[],
  hostPos:    Position,
  partnerPos: Position
): boolean {
  // ── Wall Quoridor berukuran 2 sel ──────────────────────────────────────────
  // Wall H(r,c) mengisi celah antara baris r & r+1, di kolom c dan c+1
  // Wall V(r,c) mengisi celah antara kolom c & c+1, di baris r dan r+1
  //
  // Dua wall CONFLICT jika mereka share setidaknya 1 segmen (partial/total overlap).
  //
  // Conflict antar wall H:
  //   - Sama persis (r,c) → total overlap
  //   - (r, c) vs (r, c+1) atau (r, c-1) → partial overlap (share 1 ujung)
  //
  // Conflict antar wall V:
  //   - Sama persis (r,c) → total overlap
  //   - (r, c) vs (r+1, c) atau (r-1, c) → partial overlap (share 1 ujung)
  //
  // Cross-conflict (H vs V):
  //   Terjadi jika mereka saling bersilang di titik yang sama.
  //   H(r,c) bersilang dengan V(r,c) → center mereka di (r,c) sama

  if (newWall.orientation === "H") {
    // Conflict dengan wall H lain yang share segmen
    const hConflict = existingWalls.some(
      (w) =>
        w.orientation === "H" &&
        w.r === newWall.r &&
        Math.abs(w.c - newWall.c) <= 1
    );
    if (hConflict) return false;

    // Cross dengan wall V yang bersilang di pivot yang sama
    // Wall H(r,c) bersilang dengan V(r,c) di titik tengah antara (r,c) dan (r+1,c+1)
    const crossConflict = existingWalls.some(
      (w) =>
        w.orientation === "V" &&
        w.r === newWall.r &&
        w.c === newWall.c
    );
    if (crossConflict) return false;
  } else {
    // Conflict dengan wall V lain yang share segmen
    const vConflict = existingWalls.some(
      (w) =>
        w.orientation === "V" &&
        w.c === newWall.c &&
        Math.abs(w.r - newWall.r) <= 1
    );
    if (vConflict) return false;

    // Cross dengan wall H yang bersilang di pivot yang sama
    const crossConflict = existingWalls.some(
      (w) =>
        w.orientation === "H" &&
        w.r === newWall.r &&
        w.c === newWall.c
    );
    if (crossConflict) return false;
  }

  // Simulasikan wall baru
  const testWalls = [...existingWalls, newWall];

  // BFS: pastikan kedua pemain masih punya jalur ke tujuan
  const hostCanWin    = hasPath(hostPos, BOARD_SIZE - 1, testWalls);
  const partnerCanWin = hasPath(partnerPos, 0, testWalls);

  return hostCanWin && partnerCanWin;
}

/**
 * Kembalikan semua posisi wall (H dan V) yang valid untuk ditempatkan.
 * Digunakan untuk preview highlighting di board.
 */
export function getValidWalls(
  existingWalls: QuoridorWall[],
  hostPos:       Position,
  partnerPos:    Position
): QuoridorWall[] {
  const valid: QuoridorWall[] = [];

  for (let r = 0; r < BOARD_SIZE - 1; r++) {
    for (let c = 0; c < BOARD_SIZE - 1; c++) {
      const wallH: QuoridorWall = { orientation: "H", r, c };
      if (isValidWallPlacement(wallH, existingWalls, hostPos, partnerPos)) {
        valid.push(wallH);
      }

      const wallV: QuoridorWall = { orientation: "V", r, c };
      if (isValidWallPlacement(wallV, existingWalls, hostPos, partnerPos)) {
        valid.push(wallV);
      }
    }
  }

  return valid;
}
