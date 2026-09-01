import { describe, it, expect } from "vitest";
import {
  hasPath,
  isValidWallPlacement,
  getValidMoves,
  BOARD_SIZE,
} from "../lib/games/quoridor/helpers";
import type { QuoridorWall } from "../lib/types";

describe("Quoridor Algorithm & Pathfinding Tests", () => {
  it("harus mengizinkan path awal saat papan kosong", () => {
    const startHost = { r: 0, c: 4 };
    const startPartner = { r: 8, c: 4 };
    expect(hasPath(startHost, BOARD_SIZE - 1, [])).toBe(true);
    expect(hasPath(startPartner, 0, [])).toBe(true);
  });

  it("harus menolak penempatan tembok yang memblokir total jalan pemain (100% trapped)", () => {
    const hostPos = { r: 0, c: 4 };
    const partnerPos = { r: 8, c: 4 };

    // Kurung host di (0,4):
    // Kiri: V(0,3) -> blokir gerak kiri ke c=3
    // Kanan: V(0,4) -> blokir gerak kanan ke c=5
    // Bawah: H(0,4) -> blokir gerak bawah ke r=1
    const existingWalls: QuoridorWall[] = [
      { orientation: "V", r: 0, c: 3 },
      { orientation: "V", r: 0, c: 4 },
    ];
    const lastWall: QuoridorWall = { orientation: "H", r: 0, c: 4 };

    const isValid = isValidWallPlacement(
      lastWall,
      existingWalls,
      hostPos,
      partnerPos
    );

    expect(isValid).toBe(false);
  });

  it("harus menolak tembok yang bertumpuk (overlap) atau bersilang di pivot sama", () => {
    const hostPos = { r: 0, c: 4 };
    const partnerPos = { r: 8, c: 4 };
    const existing: QuoridorWall[] = [{ orientation: "H", r: 3, c: 3 }];

    expect(
      isValidWallPlacement({ orientation: "H", r: 3, c: 3 }, existing, hostPos, partnerPos)
    ).toBe(false);

    expect(
      isValidWallPlacement({ orientation: "H", r: 3, c: 4 }, existing, hostPos, partnerPos)
    ).toBe(false);

    expect(
      isValidWallPlacement({ orientation: "V", r: 3, c: 3 }, existing, hostPos, partnerPos)
    ).toBe(false);
  });

  it("harus menghitung lompatan pion jika berhadapan dengan lawan", () => {
    const myPos = { r: 4, c: 4 };
    const oppPos = { r: 3, c: 4 };
    const walls: QuoridorWall[] = [];

    const moves = getValidMoves(myPos, oppPos, walls);
    expect(moves).toContainEqual({ r: 2, c: 4 });
  });
});
