"use client";

import { useState } from "react";

interface ShareResultProps {
  gameName: string;
  gameEmoji: string;
  result: "win" | "lose" | "draw" | "complete";
  summary?: string;
  partnerName?: string;
  myName?: string;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  playedAt?: string;
}

const RESULT_CONFIG = {
  win: {
    emoji: "🏆",
    label: "Menang!",
    color: "#FBBF24",
    bg: "border-yellow-500/30 bg-yellow-500/10",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Aku baru aja menang ${game} di LDR-Connect! 🏆${partner ? ` vs ${partner}` : ""}${summary ? `\n${summary}` : ""}\n\nMain bareng pasangan kamu juga di ldr-connect.netlify.app 💕`,
  },
  lose: {
    emoji: "😅",
    label: "Kalah nih...",
    color: "#F87171",
    bg: "border-red-500/20 bg-red-500/8",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Baru main ${game} di LDR-Connect${partner ? ` sama ${partner}` : ""} dan kalah 😅${summary ? `\n${summary}` : ""}\n\nRevans besok! Main juga di ldr-connect.netlify.app 💕`,
  },
  draw: {
    emoji: "🤝",
    label: "Seri!",
    color: "#9B93B0",
    bg: "border-white/20 bg-white/5",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Seri di ${game}${partner ? ` bareng ${partner}` : ""} di LDR-Connect! 🤝${summary ? `\n${summary}` : ""}\n\nRematch segera! ldr-connect.netlify.app 💕`,
  },
  complete: {
    emoji: "🎉",
    label: "Selesai!",
    color: "#34D399",
    bg: "border-[#34D399]/25 bg-[#34D399]/8",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Baru selesai main ${game}${partner ? ` bareng ${partner}` : ""} di LDR-Connect! 🎉${summary ? `\n${summary}` : ""}\n\nSeru banget! Coba juga di ldr-connect.netlify.app 💕`,
  },
};

export function ShareResult({
  gameName,
  gameEmoji,
  result,
  summary,
  partnerName,
  myName,
  myAvatarUrl,
  partnerAvatarUrl,
  playedAt,
}: ShareResultProps) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const config = RESULT_CONFIG[result];
  const shareText = config.shareText(gameName, summary, partnerName);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  async function handleCopyText() {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const canNativeShare =
    typeof navigator !== "undefined" && !!navigator.share;

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: `LDR-Connect — ${gameName}`,
        text: shareText,
      });
    } catch {
      // user dismissed — ignore
    }
  }

  async function handleDownloadImage() {
    setGenerating(true);
    try {
      // 9:16 — rasio WA/IG Story
      const W = 1080, H = 1920;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const cx = W / 2;
      const SF = `'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',system-ui,sans-serif`;

      // ── BG ───────────────────────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0A0A0F");
      bgGrad.addColorStop(0.5, "#0D0D15");
      bgGrad.addColorStop(1, "#0A0A0B");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Ambient glow (result color)
      const glow = ctx.createRadialGradient(cx, 780, 0, cx, 780, 600);
      glow.addColorStop(0, config.color + "30");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Secondary purple glow bottom
      const glow2 = ctx.createRadialGradient(cx, H - 200, 0, cx, H - 200, 400);
      glow2.addColorStop(0, "#818CF820");
      glow2.addColorStop(1, "transparent");
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, W, H);

      // ── Star particles ───────────────────────────────────────
      const stars = [
        [120,200,2],[320,140,1.5],[680,180,2],[900,120,1.5],[980,300,2],
        [60,450,1],[200,380,1.5],[820,420,1],[960,500,2],[140,650,1.5],
        [880,680,1],[50,900,2],[970,850,1.5],[200,1100,1],[900,1050,2],
        [120,1300,1.5],[950,1250,1],[300,1500,2],[800,1480,1.5],[60,1700,1],
        [980,1650,2],[400,1750,1.5],[700,1780,1],[200,1850,2],[850,1820,1.5],
      ];
      for (const [sx, sy, sr] of stars) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fill();
      }

      // Small hearts scattered
      const hearts = [[180,350],[860,400],[100,800],[950,750],[200,1200],[850,1150],[140,1600],[900,1550]];
      ctx.font = `24px ${SF}`;
      ctx.globalAlpha = 0.15;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const [hx, hy] of hearts) {
        ctx.fillText("💕", hx, hy);
      }
      ctx.globalAlpha = 1;

      // ── Top header bar ───────────────────────────────────────
      const topGrad = ctx.createLinearGradient(0, 0, W, 0);
      topGrad.addColorStop(0, "#FF3D7F");
      topGrad.addColorStop(1, "#818CF8");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, W, 6);

      // LDR-Connect logo area
      ctx.textBaseline = "alphabetic";
      ctx.font = `bold 40px ${SF}`;
      ctx.fillStyle = "#FF3D7F";
      ctx.textAlign = "center";
      ctx.fillText("LDR-Connect", cx, 110);
      ctx.font = `26px ${SF}`;
      ctx.fillStyle = "#5C5470";
      ctx.fillText("Game Platform Pasangan LDR 💕", cx, 148);

      // ── Game badge pill ───────────────────────────────────────
      const badgeY = 220;
      const badgeText = `${gameEmoji}  ${gameName}`;
      ctx.font = `32px ${SF}`;
      const badgeW = ctx.measureText(badgeText).width + 60;
      const badgeX = cx - badgeW / 2;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, 54, 27);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, 54, 27);
      ctx.stroke();
      ctx.fillStyle = "#9B93B0";
      ctx.fillText(badgeText, cx, badgeY + 37);

      // ── Result glow circle ────────────────────────────────────
      const glowCircle = ctx.createRadialGradient(cx, 580, 0, cx, 580, 180);
      glowCircle.addColorStop(0, config.color + "40");
      glowCircle.addColorStop(0.6, config.color + "10");
      glowCircle.addColorStop(1, "transparent");
      ctx.fillStyle = glowCircle;
      ctx.beginPath();
      ctx.arc(cx, 580, 180, 0, Math.PI * 2);
      ctx.fill();

      // Result emoji
      ctx.font = `160px ${SF}`;
      ctx.fillStyle = "#FFF5F8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.emoji, cx, 570);

      // Result label
      ctx.font = `bold 100px ${SF}`;
      ctx.fillStyle = config.color;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(config.label, cx, 760);

      // ── Divider with hearts ───────────────────────────────────
      const d1Y = 810;
      const dGrad = ctx.createLinearGradient(80, d1Y, W - 80, d1Y);
      dGrad.addColorStop(0, "transparent");
      dGrad.addColorStop(0.3, "rgba(255,61,127,0.3)");
      dGrad.addColorStop(0.7, "rgba(129,140,248,0.3)");
      dGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = dGrad;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80, d1Y); ctx.lineTo(W - 80, d1Y); ctx.stroke();

      // ── Player avatars section ────────────────────────────────
      const avatarY = 960;
      const avatarR = 80;
      const leftX = W / 2 - 220;
      const rightX = W / 2 + 220;

      // helper: load image as HTMLImageElement (returns null on failure)
      async function loadImg(url: string): Promise<HTMLImageElement | null> {
        return new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          // Cache bust agar tidak kena CORS cache
          img.src = url.includes("?") ? url : `${url}?t=${Date.now()}`;
        });
      }

      async function drawAvatar(x: number, name: string, isWinner: boolean, photoUrl?: string | null) {
        // Outer ring
        const ringGrad = ctx.createLinearGradient(x - avatarR, avatarY - avatarR, x + avatarR, avatarY + avatarR);
        ringGrad.addColorStop(0, isWinner ? config.color : "rgba(255,255,255,0.15)");
        ringGrad.addColorStop(1, isWinner ? "#818CF8" : "rgba(255,255,255,0.05)");
        ctx.strokeStyle = ringGrad;
        ctx.lineWidth = isWinner ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(x, avatarY, avatarR + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Clip circle for photo
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, avatarY, avatarR, 0, Math.PI * 2);
        ctx.clip();

        if (photoUrl) {
          const img = await loadImg(photoUrl);
          if (img) {
            // Fill bg first
            ctx.fillStyle = "#111113";
            ctx.fillRect(x - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            // Draw image centered & cropped
            const size = avatarR * 2;
            ctx.drawImage(img, x - avatarR, avatarY - avatarR, size, size);
          } else {
            // Fallback initials
            ctx.fillStyle = isWinner ? config.color + "30" : "rgba(255,255,255,0.06)";
            ctx.fillRect(x - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            ctx.font = `bold 64px ${SF}`;
            ctx.fillStyle = isWinner ? config.color : "#9B93B0";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText((name?.[0] ?? "?").toUpperCase(), x, avatarY);
          }
        } else {
          // No photo — draw initials bg + letter
          ctx.fillStyle = isWinner ? config.color + "30" : "rgba(255,255,255,0.06)";
          ctx.fillRect(x - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
          ctx.font = `bold 64px ${SF}`;
          ctx.fillStyle = isWinner ? config.color : "#9B93B0";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText((name?.[0] ?? "?").toUpperCase(), x, avatarY);
        }

        ctx.restore();

        // Name below
        ctx.font = `34px ${SF}`;
        ctx.fillStyle = isWinner ? "#FFF5F8" : "#9B93B0";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(name || "—", x, avatarY + avatarR + 50);
        // Winner crown
        if (isWinner) {
          ctx.font = `40px ${SF}`;
          ctx.textBaseline = "alphabetic";
          ctx.fillText("👑", x, avatarY - avatarR - 10);
        }
      }

      const iAmWinner = result === "win";
      const isPartnerWinner = result === "lose";
      const isDraw = result === "draw";

      await drawAvatar(leftX, myName || "", iAmWinner, myAvatarUrl);
      await drawAvatar(rightX, partnerName || "", isPartnerWinner, partnerAvatarUrl);

      // VS or heart in center
      if (isDraw) {
        ctx.font = `56px ${SF}`;
        ctx.fillStyle = "#9B93B0";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🤝", cx, avatarY);
      } else if (result === "complete") {
        ctx.font = `56px ${SF}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("❤️", cx, avatarY);
      } else {
        ctx.font = `bold 48px ${SF}`;
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("VS", cx, avatarY);
      }

      // ── Stats card ────────────────────────────────────────────
      const cardY = 1180;
      const cardH2 = summary ? 200 : 150;
      const cardPad = 80;
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.roundRect(cardPad, cardY, W - cardPad * 2, cardH2, 24);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cardPad, cardY, W - cardPad * 2, cardH2, 24);
      ctx.stroke();

      // Left accent on card
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.roundRect(cardPad, cardY, 4, cardH2, [0, 2, 2, 0]);
      ctx.fill();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const statX = cardPad + 40;

      if (summary) {
        ctx.font = `bold 36px ${SF}`;
        ctx.fillStyle = config.color;
        ctx.fillText("📊 Statistik", statX, cardY + 54);
        ctx.font = `32px ${SF}`;
        ctx.fillStyle = "#9B93B0";
        ctx.fillText(summary, statX, cardY + 100);
        if (playedAt) {
          const d = new Date(playedAt);
          const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
          ctx.font = `28px ${SF}`;
          ctx.fillStyle = "#5C5470";
          ctx.fillText(`🗓️  ${label}`, statX, cardY + 148);
        }
      } else {
        ctx.font = `bold 34px ${SF}`;
        ctx.fillStyle = "#9B93B0";
        ctx.fillText(`${gameEmoji}  ${gameName}`, statX, cardY + 80);
      }

      // ── Tagline ───────────────────────────────────────────────
      const tagY = 1480;
      const taglines: Record<string, string> = {
        win:  "Kemenangan manis buat pasangan LDR! 🏆💕",
        lose: "Kalah hari ini, menang besok bersama! 💪❤️",
        draw: "Seri? Berarti kalian memang serasi! 🤝💕",
        complete: "Seru main bareng, jarak bukan halangan! 🎉❤️",
      };
      ctx.font = `italic 36px ${SF}`;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.textAlign = "center";
      ctx.fillText(taglines[result] ?? "", cx, tagY);

      // ── Bottom divider ────────────────────────────────────────
      const botDivY = 1580;
      const bdGrad = ctx.createLinearGradient(80, botDivY, W - 80, botDivY);
      bdGrad.addColorStop(0, "transparent");
      bdGrad.addColorStop(0.5, "rgba(255,255,255,0.08)");
      bdGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = bdGrad;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80, botDivY); ctx.lineTo(W - 80, botDivY); ctx.stroke();

      // ── Bottom branding ───────────────────────────────────────
      // Pink dot
      ctx.beginPath();
      ctx.arc(cx - 120, 1660, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#FF3D7F";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 120, 1660, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#818CF8";
      ctx.fill();

      ctx.font = `bold 44px ${SF}`;
      ctx.fillStyle = "#FFF5F8";
      ctx.textAlign = "center";
      ctx.fillText("LDR-Connect", cx, 1730);
      ctx.font = `30px ${SF}`;
      ctx.fillStyle = "#5C5470";
      ctx.fillText("ldr-connect.netlify.app", cx, 1780);

      // Bottom gradient bar
      const botBar = ctx.createLinearGradient(0, H - 6, W, H - 6);
      botBar.addColorStop(0, "#818CF8");
      botBar.addColorStop(1, "#FF3D7F");
      ctx.fillStyle = botBar;
      ctx.fillRect(0, H - 6, W, 6);

      // ── Download ──────────────────────────────────────────────
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `ldr-connect-${gameName.toLowerCase().replace(/\s+/g, "-")}.png`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
        setGenerating(false);
      }, "image/png");
    } catch {
      setGenerating(false);
    }
  }

  return (
    <div className={`overflow-hidden rounded-2xl border ${config.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: config.color }}>
            {config.label}
          </p>
          <p className="text-xs text-[#5C5470]">
            {gameEmoji} {gameName}
            {summary ? ` · ${summary}` : ""}
            {partnerName ? ` · vs ${partnerName}` : ""}
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <p className="mr-auto text-xs text-[#5C5470]">Bagikan momen ini:</p>

        {/* Download Image */}
        <button
          type="button"
          onClick={handleDownloadImage}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-xl bg-[#818CF8]/10 px-3 py-2 text-xs font-semibold text-[#818CF8] ring-1 ring-[#818CF8]/30 transition hover:bg-[#818CF8]/20 disabled:opacity-50"
        >
          {generating ? (
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
            </svg>
          )}
          {generating ? "Membuat..." : "Simpan Gambar"}
        </button>

        {/* WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#25D366] ring-1 ring-[#25D366]/30 transition hover:bg-[#25D366]/20"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M11.99 2C6.477 2 2 6.484 2 12.017c0 1.99.522 3.855 1.442 5.465L2.02 22l4.641-1.404A9.96 9.96 0 0011.99 22C17.515 22 22 17.516 22 12.017 22 6.508 17.515 2 11.99 2zm0 18.044a8.018 8.018 0 01-4.098-1.126l-.294-.175-3.049.922.882-3.045-.192-.313A8.003 8.003 0 013.977 12c0-4.418 3.585-8.017 8.013-8.017 4.419 0 8.014 3.6 8.014 8.017 0 4.419-3.595 8.044-8.014 8.044z" />
          </svg>
          WA
        </a>

        {/* Native Share / Copy */}
        {canNativeShare ? (
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-[#9B93B0] ring-1 ring-white/[0.07] transition hover:bg-white/10"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" strokeLinecap="round" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
            </svg>
            Share
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCopyText}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition ${
              copied
                ? "bg-[#34D399]/15 text-[#34D399] ring-[#34D399]/30"
                : "bg-white/5 text-[#9B93B0] ring-white/[0.07] hover:bg-white/10"
            }`}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Tersalin
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
