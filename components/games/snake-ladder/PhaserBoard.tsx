"use client";

import { useEffect, useRef } from "react";
import type { SnakeBoardConfig, SnakeGameState } from "@/lib/types";

const S = 500;
const CELL = S / 10;

function sqPx(sq: number): { x: number; y: number } {
  if (sq <= 0) return { x: -200, y: -200 };
  const i = sq - 1;
  const row = Math.floor(i / 10);
  const col = row % 2 === 0 ? i % 10 : 9 - (i % 10);
  return { x: col * CELL + CELL / 2, y: (9 - row) * CELL + CELL / 2 };
}

interface PhaserBoardProps {
  boardConfig: SnakeBoardConfig;
  gameState: SnakeGameState;
  hostUserId: string;
  currentUserId: string;
  onMoveDone?: () => void;
}

export function PhaserBoard({
  boardConfig,
  gameState,
  hostUserId,
  currentUserId,
  onMoveDone,
}: PhaserBoardProps) {
  const divRef  = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const myRole  = currentUserId === hostUserId ? "host" : "partner";

  // ── Init Phaser once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!divRef.current || gameRef.current) return;
    let alive = true;

    import("phaser").then((mod) => {
      if (!alive || !divRef.current || gameRef.current) return;
      const Phaser = (mod as any).default ?? (mod as any);

      const bc   = boardConfig;
      const iHp  = gameState.host_position;
      const iPp  = gameState.partner_position;
      const role = myRole;

      class BoardScene extends Phaser.Scene {
        hPion: any = null;
        pPion: any = null;
        hPos = 0;
        pPos = 0;

        constructor() { super({ key: "board" }); }

        // ── Tween wrapper returning a Promise ───────────────────────────────
        tweenP(config: object): Promise<void> {
          return new Promise(resolve =>
            this.tweens.add({ ...(config as any), onComplete: resolve })
          );
        }

        delayP(ms: number): Promise<void> {
          return new Promise(resolve => this.time.delayedCall(ms, resolve));
        }

        // ── Step-by-step pion animation with snake/ladder effects ──────────
        async animatePion(
          pion: any,
          fromSq: number,
          toSq: number,
          isPartner: boolean,
          roll?: SnakeGameState["last_roll"]
        ) {
          if (toSq <= 0) { pion.setVisible(false); return; }
          pion.setVisible(true);

          // Current position of the OTHER pion (for same-square offset)
          const otherPos = () => isPartner ? this.hPos : this.pPos;
          const off = (sq: number) => sq === otherPos() ? 6 : 0;

          // Intermediate target before snake/ladder/bounce resolves
          const stepTarget =
            roll?.snake_from ??
            roll?.ladder_from ??
            (roll?.bounced ? 100 : toSq);

          // ── First appearance ───────────────────────────────────────────────
          if (fromSq === 0) {
            const { x, y } = sqPx(stepTarget);
            pion.setPosition(x + off(stepTarget), y + off(stepTarget));
            pion.setScale(0);
            await this.tweenP({ targets: pion, scaleX: 1, scaleY: 1, duration: 380, ease: "Back.easeOut" });

            if (roll?.snake_from != null) {
              await this.delayP(180);
              const { x: tx, y: ty } = sqPx(toSq);
              await this.tweenP({ targets: pion, x: tx + off(toSq), y: ty + off(toSq), duration: 620, ease: "Quad.easeIn" });
            } else if (roll?.ladder_from != null) {
              await this.delayP(180);
              const { x: tx, y: ty } = sqPx(toSq);
              await this.tweenP({ targets: pion, x: tx + off(toSq), y: ty + off(toSq), duration: 580, ease: "Back.easeOut" });
            }
            return;
          }

          // ── Step-by-step walk ──────────────────────────────────────────────
          const STEP_MS = 170;
          for (let sq = fromSq + 1; sq <= stepTarget; sq++) {
            const { x, y } = sqPx(sq);
            await this.tweenP({
              targets: pion,
              x: x + off(sq), y: y + off(sq),
              duration: STEP_MS,
              ease: "Quad.easeInOut",
            });
          }

          // ── Snake: squish then slide down ─────────────────────────────────
          if (roll?.snake_from != null) {
            await this.delayP(180);
            await this.tweenP({ targets: pion, scaleX: 1.35, scaleY: 0.65, duration: 110, ease: "Quad.easeOut" });
            const { x, y } = sqPx(toSq);
            await this.tweenP({
              targets: pion,
              x: x + off(toSq), y: y + off(toSq),
              scaleX: 1, scaleY: 1,
              duration: 660,
              ease: "Cubic.easeIn",
            });

          // ── Ladder: small hop then shoot upward ───────────────────────────
          } else if (roll?.ladder_from != null) {
            await this.delayP(180);
            // Quick bounce before launching
            await this.tweenP({ targets: pion, y: (pion as any).y - 14, duration: 110, ease: "Quad.easeOut" });
            const { x, y } = sqPx(toSq);
            await this.tweenP({
              targets: pion,
              x: x + off(toSq), y: y + off(toSq),
              duration: 560,
              ease: "Back.easeOut",
            });

          // ── Bounce: stepped to 100, then snap back ────────────────────────
          } else if (roll?.bounced) {
            await this.delayP(140);
            // Small shake to signal overshoot
            const cx = (pion as any).x;
            await this.tweenP({ targets: pion, x: cx + 5, duration: 60, ease: "Quad.easeOut" });
            await this.tweenP({ targets: pion, x: cx - 5, duration: 60, ease: "Quad.easeOut" });
            await this.tweenP({ targets: pion, x: cx,     duration: 60, ease: "Quad.easeOut" });
            const { x, y } = sqPx(toSq);
            await this.tweenP({
              targets: pion,
              x: x + off(toSq), y: y + off(toSq),
              duration: 380,
              ease: "Quad.easeOut",
            });
          }
        }

        create() {
          this.cameras.main.setBackgroundColor(0xFCFBF7);
          this.drawCells();
          this.drawLadders();
          this.drawSnakes();
          this.makePions(iHp, iPp);

          // React → Phaser bridge
          this.game.events.on("move", async (payload: any) => {
            const { hp, pp, lastRoll, onDone } = payload;

            const hMoved = hp !== this.hPos;
            const pMoved = pp !== this.pPos;

            if (!hMoved && !pMoved) {
              onDone?.();
              return;
            }

            const hostJustRolled = lastRoll?.player === "host";

            if (hMoved && hostJustRolled) {
              await this.animatePion(this.hPion, this.hPos, hp, false, lastRoll);
              this.hPos = hp;
              if (pMoved) {
                await this.animatePion(this.pPion, this.pPos, pp, true, undefined);
                this.pPos = pp;
              }
            } else if (pMoved && !hostJustRolled) {
              await this.animatePion(this.pPion, this.pPos, pp, true, lastRoll);
              this.pPos = pp;
              if (hMoved) {
                await this.animatePion(this.hPion, this.hPos, hp, false, undefined);
                this.hPos = hp;
              }
            } else {
              if (hMoved) {
                await this.animatePion(this.hPion, this.hPos, hp, false, undefined);
                this.hPos = hp;
              }
              if (pMoved) {
                await this.animatePion(this.pPion, this.pPos, pp, true, undefined);
                this.pPos = pp;
              }
            }

            onDone?.();
          });
        }

        // ── Draw board cells ─────────────────────────────────────────────────
        drawCells() {
          const g = this.add.graphics().setDepth(0);

          for (let sq = 1; sq <= 100; sq++) {
            const { x, y } = sqPx(sq);
            const lx = x - CELL / 2;
            const ly = y - CELL / 2;

            if (sq === 100) {
              g.fillStyle(0xFEF3C7, 1);
              g.fillRect(lx + 1, ly + 1, CELL - 2, CELL - 2);
              g.lineStyle(1.5, 0xFDE68A, 1);
            } else if (bc.snakes.some((s) => s.from === sq)) {
              g.fillStyle(0xFEF2F2, 1);
              g.fillRect(lx + 1, ly + 1, CELL - 2, CELL - 2);
              g.lineStyle(1, 0xFECACA, 1);
            } else if (bc.ladders.some((l) => l.from === sq)) {
              g.fillStyle(0xEBF9EB, 1);
              g.fillRect(lx + 1, ly + 1, CELL - 2, CELL - 2);
              g.lineStyle(1, 0xBBF7D0, 1);
            } else if (bc.challenges.some((c) => c.square === sq)) {
              g.fillStyle(0xFEF3C7, 1);
              g.fillRect(lx + 1, ly + 1, CELL - 2, CELL - 2);
              g.lineStyle(1, 0xFDE68A, 1);
            } else {
              const idx = sq - 1;
              const row = Math.floor(idx / 10);
              const col = idx % 10;
              const light = (row + col) % 2 === 0;
              g.fillStyle(light ? 0xffffff : 0xFCFBF7, 1);
              g.fillRect(lx + 1, ly + 1, CELL - 2, CELL - 2);
              g.lineStyle(1, 0xE7E5E4, 1);
            }
            g.strokeRect(lx, ly, CELL, CELL);

            if (sq === 100) {
              this.add.text(x, y + 13, "100", {
                fontSize: "9px", color: "#D97706",
                fontStyle: "bold", fontFamily: "sans-serif",
              }).setOrigin(0.5).setDepth(1);
              this.add.text(x, y - 11, "🏆", { fontSize: "14px" })
                .setOrigin(0.5).setDepth(2);
            } else if (sq === 1) {
              this.add.text(x, y + 8, "1", {
                fontSize: "8px", color: "#C84B31", fontStyle: "bold", fontFamily: "sans-serif",
              }).setOrigin(0.5).setDepth(1);
              this.add.text(x, y - 7, "START", {
                fontSize: "5.5px", color: "#78716C", fontStyle: "bold", fontFamily: "sans-serif",
              }).setOrigin(0.5).setDepth(2);
            } else {
              this.add.text(x, y, `${sq}`, {
                fontSize: "8px", color: "#78716C", fontFamily: "sans-serif",
              }).setOrigin(0.5).setDepth(1);
            }

            const chal = bc.challenges.find((c) => c.square === sq);
            if (chal) {
              this.add.text(lx + CELL - 2, ly + 2, chal.type === "dare" ? "⚡" : "✦", {
                fontSize: "9px",
                color: chal.type === "dare" ? "#D97706" : "#2563EB",
              }).setOrigin(1, 0).setDepth(2);
            }
          }
        }

        // ── Draw ladders ─────────────────────────────────────────────────────
        drawLadders() {
          const g = this.add.graphics().setDepth(3);

          for (const lad of bc.ladders) {
            const f  = sqPx(lad.from);
            const t  = sqPx(lad.to);
            const dx = t.x - f.x;
            const dy = t.y - f.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = (-dy / len) * 4.5;
            const ny = ( dx / len) * 4.5;

            g.lineStyle(2.5, 0xCD853F, 0.9);
            for (const s of [1, -1] as const) {
              g.beginPath();
              g.moveTo(f.x + nx * s, f.y + ny * s);
              g.lineTo(t.x + nx * s, t.y + ny * s);
              g.strokePath();
            }

            g.lineStyle(1.8, 0xE8B84B, 0.85);
            for (let i = 1; i <= 5; i++) {
              const tt = i / 6;
              g.beginPath();
              g.moveTo(f.x + nx + dx * tt, f.y + ny + dy * tt);
              g.lineTo(f.x - nx + dx * tt, f.y - ny + dy * tt);
              g.strokePath();
            }

            g.fillStyle(0x22C55E, 0.8);
            g.fillCircle(f.x, f.y, 4);
            g.fillStyle(0x22C55E, 0.35);
            g.fillCircle(t.x, t.y, 3);
          }
        }

        // ── Draw snakes ──────────────────────────────────────────────────────
        drawSnakes() {
          const g = this.add.graphics().setDepth(4);

          for (const sn of bc.snakes) {
            const h  = sqPx(sn.from);
            const t  = sqPx(sn.to);
            const dx = t.x - h.x;
            const dy = t.y - h.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny =  dx / len;

            const pts: { x: number; y: number }[] = [];
            const steps = 80;
            const amp   = 7;
            const waves = 3;
            for (let i = 0; i <= steps; i++) {
              const tt = i / steps;
              const w  = Math.sin(tt * Math.PI * 2 * waves) * amp;
              pts.push({ x: h.x + dx * tt + nx * w, y: h.y + dy * tt + ny * w });
            }

            g.lineStyle(9, 0xFF3D3D, 0.08);
            g.strokePoints(pts, false);
            g.lineStyle(4, 0xE53E3E, 0.95);
            g.strokePoints(pts, false);

            g.fillStyle(0xFF3D3D, 1);
            g.fillCircle(h.x, h.y, 7);
            g.lineStyle(1.5, 0xFF8080, 0.7);
            g.strokeCircle(h.x, h.y, 7);

            const ex = (dx / len) * 2.5;
            const ey = (dy / len) * 2.5;
            for (const s of [1, -1] as const) {
              const eyeX = h.x + nx * 2.8 * s + ex;
              const eyeY = h.y + ny * 2.8 * s + ey;
              g.fillStyle(0xffffff, 1);
              g.fillCircle(eyeX, eyeY, 2.2);
              g.fillStyle(0x111111, 1);
              g.fillCircle(eyeX + ex * 0.2, eyeY + ey * 0.2, 1.1);
            }

            g.fillStyle(0x7B1010, 0.85);
            g.fillCircle(t.x, t.y, 3.5);
          }
        }

        // ── Create pion game objects ──────────────────────────────────────────
        makePions(initHp: number, initPp: number) {
          const mkPion = (color: number, label: string): any => {
            const g = this.add.graphics();
            g.fillStyle(color, 0.18);
            g.fillCircle(0, 0, 16);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(0, 0, 11);
            g.fillStyle(color, 1);
            g.fillCircle(0, 0, 9.5);

            const txt = this.add.text(0, 0.5, label, {
              fontSize: "9px", color: "#ffffff",
              fontStyle: "bold", fontFamily: "Arial, sans-serif",
            }).setOrigin(0.5);

            return this.add.container(0, 0, [g, txt]).setDepth(20);
          };

          this.hPion = mkPion(0xC84B31, "H");
          this.pPion = mkPion(0x2563EB, "P");

          const myPion = role === "host" ? this.hPion : this.pPion;
          const dot = this.add.graphics();
          dot.fillStyle(0xD97706, 1);
          dot.fillCircle(8, -8, 3.5);
          dot.lineStyle(0.8, 0xffffff, 0.8);
          dot.strokeCircle(8, -8, 3.5);
          myPion.add(dot);

          if (initHp > 0) {
            const p = sqPx(initHp);
            this.hPion.setPosition(p.x, p.y);
            this.hPos = initHp;
          } else {
            this.hPion.setVisible(false);
          }
          if (initPp > 0) {
            const p   = sqPx(initPp);
            const off = initPp === initHp ? 6 : 0;
            this.pPion.setPosition(p.x + off, p.y + off);
            this.pPos = initPp;
          } else {
            this.pPion.setVisible(false);
          }
        }
      }

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: S,
        height: S,
        backgroundColor: 0xFCFBF7,
        parent: divRef.current,
        scene: BoardScene,
        antialias: true,
        banner: false,
        audio: { disableWebAudio: true },
      });

      setTimeout(() => {
        const canvas = divRef.current?.querySelector("canvas");
        if (canvas) {
          canvas.style.width  = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
        }
      }, 80);

      gameRef.current = game;
    });

    return () => {
      alive = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync positions — emit payload with roll context + done callback ───────
  useEffect(() => {
    if (!gameRef.current) {
      // Phaser not ready yet — unblock immediately so challenge modal can show
      onMoveDone?.();
      return;
    }
    gameRef.current.events.emit("move", {
      hp: gameState.host_position,
      pp: gameState.partner_position,
      lastRoll: gameState.last_roll ?? undefined,
      onDone: onMoveDone,
    });
  // onMoveDone is intentionally excluded — stable useCallback reference, no loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.host_position, gameState.partner_position]);

  return (
    <div className="w-full space-y-3">
      <div
        ref={divRef}
        className="w-full mx-auto rounded-2xl overflow-hidden border border-[#E7E5E4] shadow-xl shadow-black/2 bg-white"
        style={{ maxWidth: S }}
      />

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[10px] text-[#78716C]">
        <span className="flex items-center gap-1">🐍 Kepala ular (turun)</span>
        <span className="flex items-center gap-1">🪜 Bawah tangga (naik)</span>
        <span className="flex items-center gap-1">⚡ Dare</span>
        <span className="flex items-center gap-1">✦ Truth</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#C84B31]" />
          H = Host{myRole === "host" ? " (kamu ★)" : ""}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2563EB]" />
          P = Partner{myRole === "partner" ? " (kamu ★)" : ""}
        </span>
      </div>
    </div>
  );
}
