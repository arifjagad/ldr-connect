"use client";

import { useEffect, useRef } from "react";

interface ConfettiProps {
  active: boolean;
  duration?: number; // ms, default 3000
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle";
  alpha: number;
};

const COLORS = [
  "#FF3D7F", "#FF6B9D", "#818CF8", "#A78BFA",
  "#34D399", "#FBBF24", "#F97316", "#60A5FA",
];

/**
 * Canvas-based konfetti animation.
 * Gunakan: <Konfetti active={isWinner} />
 */
export function Konfetti({ active, duration = 3500 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    // Spawn banyak partikel dari atas
    const particles: Particle[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * W,
      y: Math.random() * -H * 0.3,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 6,
      shape: Math.random() > 0.5 ? "rect" : "circle",
      alpha: 1,
    }));

    const startTime = performance.now();

    function draw(now: number) {
      if (!ctx || !canvas) return;
      const elapsed = now - startTime;
      const fadeStart = duration * 0.65;
      ctx.clearRect(0, 0, W, H);

      let alive = false;
      for (const p of particles) {
        // Fade out saat mendekati akhir
        if (elapsed > fadeStart) {
          p.alpha = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
        }
        if (p.alpha <= 0) continue;
        alive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (alive && elapsed < duration + 1000) {
        animRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ctx.clearRect(0, 0, W, H);
    };
  }, [active, duration]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9998]"
      aria-hidden
    />
  );
}
