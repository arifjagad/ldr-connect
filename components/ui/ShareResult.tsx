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
  /** Statistik terstruktur untuk ditampilkan di gambar share */
  stats?: Array<{ label: string; value: string }>;
}

const RESULT_CONFIG = {
  win: {
    emoji: "🏆",
    label: "Menang!",
    color: "#D97706",
    bg: "border-[#FDE68A] bg-[#FEF3C7]/40",
    badge: "border-[#FDE68A] bg-[#FEF3C7] text-[#D97706]",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Aku baru aja menang ${game} di LDR-Connect! 🏆${partner ? ` vs ${partner}` : ""}${summary ? `\n${summary}` : ""}\n\nMain bareng pasangan kamu juga di ldr-connect.netlify.app 💕`,
  },
  lose: {
    emoji: "😅",
    label: "Kalah nih...",
    color: "#C84B31",
    bg: "border-[#FBDCD5] bg-[#FDF4F2]",
    badge: "border-[#FBDCD5] bg-[#FDF4F2] text-[#C84B31]",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Baru main ${game} di LDR-Connect${partner ? ` sama ${partner}` : ""} dan kalah 😅${summary ? `\n${summary}` : ""}\n\nRevans besok! Main juga di ldr-connect.netlify.app 💕`,
  },
  draw: {
    emoji: "🤝",
    label: "Seri!",
    color: "#78716C",
    bg: "border-[#E7E5E4] bg-[#FCFBF7]",
    badge: "border-[#E7E5E4] bg-[#F5F5F4] text-[#78716C]",
    shareText: (game: string, summary?: string, partner?: string) =>
      `Seri di ${game}${partner ? ` bareng ${partner}` : ""} di LDR-Connect! 🤝${summary ? `\n${summary}` : ""}\n\nRematch segera! ldr-connect.netlify.app 💕`,
  },
  complete: {
    emoji: "🎉",
    label: "Selesai!",
    color: "#10B981",
    bg: "border-[#10B981]/20 bg-[#EBF9EB]/40",
    badge: "border-[#10B981]/20 bg-[#EBF9EB] text-[#10B981]",
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
  stats,
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
      const SF = `'Playfair Display', Georgia, serif`;
      const SANS = `'Inter', system-ui, -apple-system, sans-serif`;

      // ── BG Ground (#FCFBF7) ───────────────────────────────────
      ctx.fillStyle = "#FCFBF7";
      ctx.fillRect(0, 0, W, H);

      // Top Terracotta Accent Bar
      ctx.fillStyle = "#C84B31";
      ctx.fillRect(0, 0, W, 12);

      // ── Top header ───────────────────────────────────────────
      ctx.textBaseline = "alphabetic";
      ctx.font = `bold 44px ${SF}`;
      ctx.fillStyle = "#C84B31";
      ctx.textAlign = "center";
      ctx.fillText("LDR-Connect", cx, 130);
      ctx.font = `24px ${SANS}`;
      ctx.fillStyle = "#78716C";
      ctx.fillText("Platform Game & Jurnal Pasangan LDR", cx, 175);

      // ── Game badge pill ───────────────────────────────────────
      const badgeY = 240;
      const badgeText = `${gameEmoji}  ${gameName}`;
      ctx.font = `bold 28px ${SANS}`;
      const badgeW = ctx.measureText(badgeText).width + 60;
      const badgeX = cx - badgeW / 2;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, 56, 28);
      ctx.fill();
      ctx.strokeStyle = "#E7E5E4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, 56, 28);
      ctx.stroke();
      ctx.fillStyle = "#1F1D1B";
      ctx.fillText(badgeText, cx, badgeY + 38);

      // ── Result emoji & title ──────────────────────────────────
      ctx.font = `140px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.emoji, cx, 540);

      // Result label
      ctx.font = `bold 90px ${SF}`;
      ctx.fillStyle = config.color;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(config.label, cx, 710);

      // ── Divider ──────────────────────────────────────────────
      const d1Y = 760;
      ctx.strokeStyle = "#E7E5E4";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(120, d1Y); ctx.lineTo(W - 120, d1Y); ctx.stroke();

      // ── Player avatars section ────────────────────────────────
      const avatarY = 930;
      const avatarR = 85;
      const leftX = W / 2 - 220;
      const rightX = W / 2 + 220;

      async function loadImg(url: string): Promise<HTMLImageElement | null> {
        return new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url.includes("?") ? url : `${url}?t=${Date.now()}`;
        });
      }

      async function drawAvatar(x: number, name: string, isWinner: boolean, photoUrl?: string | null) {
        ctx.strokeStyle = isWinner ? config.color : "#E7E5E4";
        ctx.lineWidth = isWinner ? 4 : 2;
        ctx.beginPath();
        ctx.arc(x, avatarY, avatarR + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, avatarY, avatarR, 0, Math.PI * 2);
        ctx.clip();

        if (photoUrl) {
          const img = await loadImg(photoUrl);
          if (img) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(x - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            ctx.drawImage(img, x - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
          } else {
            ctx.fillStyle = "#FDF4F2";
            ctx.fillRect(x - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            ctx.font = `bold 64px ${SANS}`;
            ctx.fillStyle = "#C84B31";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText((name?.[0] ?? "?").toUpperCase(), x, avatarY);
          }
        } else {
          ctx.fillStyle = "#FDF4F2";
          ctx.fillRect(x - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
          ctx.font = `bold 64px ${SANS}`;
          ctx.fillStyle = "#C84B31";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText((name?.[0] ?? "?").toUpperCase(), x, avatarY);
        }

        ctx.restore();

        ctx.font = `bold 32px ${SANS}`;
        ctx.fillStyle = isWinner ? "#1F1D1B" : "#78716C";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(name || "—", x, avatarY + avatarR + 50);

        if (isWinner) {
          ctx.font = `40px ${SANS}`;
          ctx.fillText("👑", x, avatarY - avatarR - 14);
        }
      }

      const iAmWinner = result === "win";
      const isPartnerWinner = result === "lose";
      const isDraw = result === "draw";

      await drawAvatar(leftX, myName || "", iAmWinner, myAvatarUrl);
      await drawAvatar(rightX, partnerName || "", isPartnerWinner, partnerAvatarUrl);

      // VS
      ctx.font = `bold 44px ${SANS}`;
      ctx.fillStyle = "#A8A29E";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isDraw ? "🤝" : result === "complete" ? "❤️" : "VS", cx, avatarY);

      // ── Stats card ─────────────────────────────────────────
      const cardY = 1150;
      const cardPad = 80;
      const statX = cardPad + 50;
      const statXR = W - cardPad - 50;

      const hasStats = stats && stats.length > 0;
      const rowH = 64;
      const cardHeaderH = 70;
      const cardDateH = playedAt ? 56 : 0;
      const cardH2 = hasStats
        ? cardHeaderH + stats.length * rowH + cardDateH + 40
        : summary
        ? 220
        : 160;

      // Card surface
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(cardPad, cardY, W - cardPad * 2, cardH2, 28);
      ctx.fill();
      ctx.strokeStyle = "#E7E5E4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardPad, cardY, W - cardPad * 2, cardH2, 28);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      if (hasStats) {
        ctx.font = `bold 32px ${SANS}`;
        ctx.fillStyle = "#1F1D1B";
        ctx.fillText("📊 Statistik Permainan", statX, cardY + 54);

        ctx.strokeStyle = "#F5F5F4";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(statX, cardY + 68);
        ctx.lineTo(statXR, cardY + 68);
        ctx.stroke();

        stats.forEach((row, i) => {
          const ry = cardY + cardHeaderH + i * rowH + 20;
          ctx.font = `26px ${SANS}`;
          ctx.fillStyle = "#78716C";
          ctx.textAlign = "left";
          ctx.fillText(row.label, statX, ry);

          ctx.font = `bold 26px ${SANS}`;
          ctx.fillStyle = "#1F1D1B";
          ctx.textAlign = "right";
          ctx.fillText(row.value, statXR, ry);
        });

        if (playedAt) {
          const dateY = cardY + cardHeaderH + stats.length * rowH + 46;
          const d = new Date(playedAt);
          const dateLabel = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
          ctx.font = `24px ${SANS}`;
          ctx.fillStyle = "#A8A29E";
          ctx.textAlign = "left";
          ctx.fillText(`🗓️  ${dateLabel}`, statX, dateY);
        }
      } else if (summary) {
        ctx.font = `bold 32px ${SANS}`;
        ctx.fillStyle = "#1F1D1B";
        ctx.fillText("📊 Ringkasan", statX, cardY + 54);
        ctx.font = `28px ${SANS}`;
        ctx.fillStyle = "#78716C";
        ctx.fillText(summary, statX, cardY + 110);
      }

      // ── Bottom branding ───────────────────────────────────────
      ctx.font = `bold 40px ${SF}`;
      ctx.fillStyle = "#1F1D1B";
      ctx.textAlign = "center";
      ctx.fillText("LDR-Connect", cx, 1750);
      ctx.font = `24px ${SANS}`;
      ctx.fillStyle = "#78716C";
      ctx.fillText("ldr-connect.netlify.app", cx, 1795);

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
    <div className={`overflow-hidden rounded-2xl border ${config.bg} shadow-xl shadow-black/2`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#E7E5E4] px-4 py-3 bg-white">
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <p className="text-xs font-bold" style={{ color: config.color }}>
            {config.label}
          </p>
          <p className="text-[11px] text-[#78716C]">
            {gameEmoji} {gameName}
            {summary ? ` · ${summary}` : ""}
            {partnerName ? ` · vs ${partnerName}` : ""}
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-[#FCFBF7]">
        <p className="mr-auto text-xs font-semibold text-[#78716C]">Bagikan momen ini:</p>

        {/* Download Image */}
        <button
          type="button"
          onClick={handleDownloadImage}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-xl border border-[#E7E5E4] bg-white px-3 py-2 text-xs font-semibold text-[#1F1D1B] shadow-2xs transition hover:border-[#D6D3D1] disabled:opacity-50 cursor-pointer"
        >
          {generating ? (
            <svg className="animate-spin text-[#C84B31]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          className="flex items-center gap-1.5 rounded-xl border border-[#10B981]/20 bg-[#EBF9EB] px-3 py-2 text-xs font-bold text-[#10B981] transition hover:bg-[#10B981]/15"
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
            className="flex items-center gap-1.5 rounded-xl border border-[#E7E5E4] bg-white px-3 py-2 text-xs font-semibold text-[#78716C] shadow-2xs transition hover:border-[#D6D3D1] hover:text-[#1F1D1B] cursor-pointer"
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
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              copied
                ? "border-[#10B981]/20 bg-[#EBF9EB] text-[#10B981]"
                : "border-[#E7E5E4] bg-white text-[#78716C] shadow-2xs hover:border-[#D6D3D1] hover:text-[#1F1D1B]"
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
