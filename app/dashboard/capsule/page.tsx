"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Capsule } from "@/lib/types";
import { DatePicker } from "@/components/DatePicker";

const supabase = createClient();

// ── Confetti Canvas ───────────────────────────────────────────────────────────
function fireConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: { x: number; y: number; vx: number; vy: number; color: string; r: number; angle: number; spin: number }[] = [];
  const colors = ["#F472B6", "#818CF8", "#34D399", "#FBBF24", "#E879F9", "#60A5FA"];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.8) * 14,
      color: colors[Math.floor(Math.random() * colors.length)],
      r: Math.random() * 6 + 3,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
    });
  }

  let frame = 0;
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.angle += p.spin;
      p.vx *= 0.99;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 2);
      ctx.restore();
    });
    frame++;
    if (frame < 150) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// Days Until ────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string) {
  // Tambah T00:00:00 TANPA 'Z' agar diparsing sebagai local midnight, bukan UTC.
  // Tanpa ini, "2026-06-03" = UTC midnight → di WIB (UTC+7) jadi +7 jam ekstra
  // yang menyebabkan Math.ceil menghitung 2 hari padahal seharusnya 1 hari.
  const openDate = new Date(dateStr + "T00:00:00");
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return Math.ceil((openDate.getTime() - todayMidnight.getTime()) / 86400000);
}

function formatDate(d: string) {
  // Tambahkan T00:00:00 untuk date-only strings agar diparsing sebagai local time
  // bukan UTC midnight (yang bisa menyebabkan tampil mundur 1 hari di WIB)
  const date = d.includes("T") ? new Date(d) : new Date(d + "T00:00:00");
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// ── Opening Animation Component ───────────────────────────────────────────────
function CapsuleOpeningScene({ capsule, onOpened }: { capsule: Capsule; onOpened: (data: Capsule) => void }) {
  const [phase, setPhase] = useState<"idle" | "shaking" | "opening" | "letter" | "reading">("idle");
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function handleOpen() {
    if (loading) return;
    setLoading(true);
    setPhase("shaking");

    setTimeout(() => setPhase("opening"), 700);
    setTimeout(() => setPhase("letter"), 1500);
    setTimeout(() => {
      if (canvasRef.current) fireConfetti(canvasRef.current);
    }, 1800);

    const res = await fetch(`/api/capsule/${capsule.id}/open`, { method: "POST" });
    const json = await res.json();

    setTimeout(() => {
      setPhase("reading");
      if (json.success) onOpened(json.data);
      setLoading(false);
    }, 2600);
  }

  return (
    <div className="relative flex flex-col items-center justify-center py-12">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" />

      {/* CSS Keyframes */}
      <style>{`
        @keyframes shake { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-6deg)} 40%{transform:rotate(6deg)} 60%{transform:rotate(-4deg)} 80%{transform:rotate(4deg)} }
        @keyframes flap  { 0%{transform:rotateX(0deg)} 100%{transform:rotateX(-180deg)} }
        @keyframes rise  { 0%{transform:translateY(60px);opacity:0} 100%{transform:translateY(-20px);opacity:1} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(244,114,182,0.3)} 50%{box-shadow:0 0 50px rgba(244,114,182,0.7), 0 0 80px rgba(232,121,249,0.4)} }
        @keyframes typewriter { from{width:0} to{width:100%} }
        .shake { animation: shake 0.6s ease-in-out; }
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>

      {/* Envelope */}
      <div
        className={`relative cursor-pointer select-none transition-all duration-700 ${
          phase === "shaking" ? "shake" : ""
        } ${phase === "idle" ? "pulse-glow rounded-3xl" : ""}`}
        style={{ width: 280, height: 200, perspective: 600 }}
        onClick={phase === "idle" ? handleOpen : undefined}
      >
        {/* Envelope body */}
        <div className={`absolute inset-0 rounded-3xl border-2 transition-all duration-700 overflow-hidden ${
          phase === "reading" ? "opacity-0 scale-75" : "opacity-100 scale-100"
        }`}
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", borderColor: "#F472B6" }}>

          {/* Envelope bottom triangle */}
          <div className="absolute bottom-0 left-0 right-0 h-0 border-x-[140px] border-b-[100px] border-x-transparent"
            style={{ borderBottomColor: "#F472B6", opacity: 0.3 }} />

          {/* Left flap */}
          <div className="absolute left-0 top-0 bottom-0 w-0 border-y-[100px] border-l-[140px] border-y-transparent"
            style={{ borderLeftColor: "rgba(244,114,182,0.15)" }} />
          {/* Right flap */}
          <div className="absolute right-0 top-0 bottom-0 w-0 border-y-[100px] border-r-[140px] border-y-transparent"
            style={{ borderRightColor: "rgba(232,121,249,0.15)" }} />

          {/* Top flap — animates open */}
          <div className="absolute top-0 left-0 right-0 origin-top"
            style={{
              height: 100,
              animation: phase === "opening" || phase === "letter" ? "flap 0.8s ease forwards" : "none",
              transformStyle: "preserve-3d",
              zIndex: 10,
            }}>
            <div className="absolute inset-0 w-0 border-x-[140px] border-t-[100px] border-x-transparent mx-auto"
              style={{ borderTopColor: "#F472B6", opacity: 0.8 }} />
          </div>

          {/* Heart seal */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`text-5xl transition-all duration-500 ${
              phase === "opening" || phase === "letter" ? "scale-0 opacity-0" : "scale-100 opacity-100"
            }`}>
              💌
            </div>
          </div>
        </div>

        {/* Letter rising from envelope */}
        {(phase === "letter" || phase === "reading") && (
          <div className="absolute -top-24 left-4 right-4 rounded-2xl border border-[#F472B6]/30 bg-[#0E0E12] p-4 text-center shadow-[0_0_40px_rgba(244,114,182,0.4)]"
            style={{ animation: "rise 0.8s ease forwards" }}>
            <div className="text-2xl mb-1">✉️</div>
            <p className="text-xs text-[#F472B6] font-semibold">Membuka kapsul...</p>
          </div>
        )}
      </div>

      {/* Label & hint */}
      {phase === "idle" && (
        <div className="mt-8 text-center">
          <p className="text-lg font-bold text-[#FFF5F8]">Tap untuk membuka 💌</p>
          <p className="mt-1 text-sm text-[#5C5470]">Kapsul sudah menunggumu</p>
        </div>
      )}

      {phase !== "idle" && phase !== "reading" && (
        <p className="mt-8 text-sm text-[#F472B6] animate-pulse">Membuka kapsul...</p>
      )}
    </div>
  );
}

// ── Message Display ────────────────────────────────────────────────────────────
function MessageCard({ capsule, isSent }: { capsule: Capsule; isSent: boolean }) {
  const days = daysUntil(capsule.opens_at);
  const isDelivered = capsule.status === "delivered";
  const isOpened = capsule.status === "opened";

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
      isOpened ? "border-[#34D399]/20 bg-[#34D399]/5"
      : isDelivered ? "border-[#F472B6]/30 bg-[#F472B6]/8 shadow-[0_0_30px_rgba(244,114,182,0.15)]"
      : "border-white/[0.08] bg-[#111113]"
    }`}>
      {/* Glow for delivered */}
      {isDelivered && (
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl"
          style={{ background: "rgba(244,114,182,0.2)" }} />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shrink-0 ${
            isOpened ? "bg-[#34D399]/15"
            : isDelivered ? "bg-[#F472B6]/15"
            : "bg-white/5"
          }`}>
            {isOpened ? "✅" : isDelivered ? "💌" : "🔒"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[#FFF5F8] text-sm">
                {isSent ? "Kapsul ke Partner" : "Kapsul dari Partner"}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isOpened ? "bg-[#34D399]/20 text-[#34D399]"
                : isDelivered ? "bg-[#F472B6]/20 text-[#F472B6]"
                : "bg-white/10 text-[#9B93B0]"
              }`}>
                {isOpened ? "Dibuka" : isDelivered ? "Siap dibuka!" : "Terkunci"}
              </span>
            </div>
            <p className="text-xs text-[#5C5470] mt-0.5">
              {isOpened ? `Dibuka ${formatDate(capsule.opened_at!)}` : `Buka: ${formatDate(capsule.opens_at)}`}
            </p>
          </div>
        </div>

        {/* Countdown / days */}
        {!isOpened && !isDelivered && (
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums text-[#FFF5F8]">{days}</p>
            <p className="text-[10px] text-[#5C5470]">hari lagi</p>
          </div>
        )}
      </div>

      {/* Progress bar countdown */}
      {!isOpened && !isDelivered && (
        <div className="mt-4">
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full rounded-full bg-[#F472B6]/50"
              style={{ width: `${Math.max(5, 100 - (days / 365) * 100)}%`, transition: "width 1s ease" }} />
          </div>
        </div>
      )}

      {/* Opened message preview */}
      {isOpened && capsule.message && (
        <div className="mt-4 rounded-xl border border-[#34D399]/15 bg-[#34D399]/5 p-3">
          <p className="text-sm text-[#9B93B0] leading-relaxed italic">"{capsule.message}"</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CapsulePage() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [openingCapsule, setOpeningCapsule] = useState<Capsule | null>(null);

  // Form
  const [message, setMessage] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  function showToast(ok: boolean, text: string) {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  }

  const loadCapsules = useCallback(async () => {
    const res = await fetch("/api/capsule");
    const json = await res.json();
    if (json.success) setCapsules(json.data ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
    loadCapsules().finally(() => setLoading(false));
  }, [loadCapsules]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("capsules-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "capsules" }, loadCapsules)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadCapsules]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!message.trim() || !opensAt) return;
    setFormLoading(true);
    const res = await fetch("/api/capsule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, opens_at: opensAt }),
    });
    const json = await res.json();
    showToast(json.success, json.message);
    if (json.success) { setMessage(""); setOpensAt(""); await loadCapsules(); }
    setFormLoading(false);
  }

  function handleOpened(data: Capsule) {
    setCapsules((prev) => prev.map((c) => c.id === data.id ? data : c));
    setOpeningCapsule(null);
    showToast(true, "Kapsul berhasil dibuka! 🎉");
  }

  // Min date: besok WIB (pakai offset +7 agar tidak salah kalkulasi UTC vs WIB)
  const tomorrowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  tomorrowWib.setDate(tomorrowWib.getDate() + 1);
  const minDate = tomorrowWib.toISOString().split("T")[0];

  const received = capsules.filter((c) => c.receiver_id === userId);
  const sent = capsules.filter((c) => c.sender_id === userId);
  const deliveredCapsule = received.find((c) => c.status === "delivered");

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes glow-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        .float { animation: float 3s ease-in-out infinite; }
        .glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full blur-[120px] glow-pulse"
          style={{ background: "rgba(244,114,182,0.07)" }} />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full blur-[120px] glow-pulse"
          style={{ background: "rgba(129,140,248,0.07)", animationDelay: "1s" }} />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl ${
          toast.ok ? "border-[#34D399]/20 bg-[#0E0E12] text-[#34D399]" : "border-red-500/20 bg-[#0E0E12] text-red-400"
        }`}>
          {toast.ok
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /></svg>
          }
          {toast.text}
        </div>
      )}

      {/* Opening Modal */}
      {openingCapsule && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-[#F472B6]/20 bg-[#0A0A0F] p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#F472B6] to-transparent" />
            <CapsuleOpeningScene capsule={openingCapsule} onOpened={handleOpened} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Kapsul Waktu</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Kapsul{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #F472B6, #E879F9, #818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Waktu
          </span>
        </h1>
        <p className="mt-2 text-sm text-[#5C5470]">Pesan yang terkunci — dibuka tepat saat momennya tiba.</p>
      </div>

      {/* Banner — jika ada kapsul yang bisa dibuka */}
      {deliveredCapsule && (
        <div className="mb-6 relative overflow-hidden rounded-2xl border border-[#F472B6]/40 p-6 cursor-pointer group"
          style={{ background: "linear-gradient(135deg, rgba(244,114,182,0.15) 0%, rgba(232,121,249,0.08) 100%)" }}
          onClick={() => setOpeningCapsule(deliveredCapsule)}>
          <div aria-hidden className="absolute -right-12 -top-12 h-48 w-48 rounded-full blur-3xl"
            style={{ background: "rgba(244,114,182,0.25)" }} />
          <div className="relative flex items-center gap-5">
            <div className="float text-5xl">💌</div>
            <div>
              <p className="text-lg font-bold text-[#FFF5F8]">Kapsul sudah bisa dibuka!</p>
              <p className="text-sm text-[#F472B6]">Partner mengirimkan sesuatu yang istimewa. Tap di sini untuk membuka.</p>
            </div>
            <svg className="ml-auto shrink-0 text-[#F472B6] transition group-hover:translate-x-1" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left — Form */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-2xl border border-[#F472B6]/15 bg-linear-to-br from-[#F472B6]/6 to-[#111113] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F472B6]/15 float">
                <span className="text-xl">✉️</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">Kirim Kapsul Baru</p>
                <p className="text-xs text-[#5C5470]">Pesan yang dibuka di masa depan</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-xs font-medium text-[#9B93B0]" htmlFor="cap-msg">
                  Tuliskan pesanmu
                </label>
                <textarea
                  id="cap-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  maxLength={2000}
                  placeholder="Tulis dari hati... Partner baru bisa membacanya nanti."
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-[#18181C] px-4 py-3 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#F472B6]/40 focus:ring-1 focus:ring-[#F472B6]/20 transition leading-relaxed"
                />
                <p className="mt-1 text-right text-[10px] text-[#5C5470]">{message.length}/2000</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9B93B0]" htmlFor="cap-date">
                  Tanggal kapsul terbuka
                </label>
                <div className="mt-1.5">
                  <DatePicker
                    value={opensAt}
                    onChange={setOpensAt}
                    min={minDate}
                    placeholder="Pilih tanggal pembukaan..."
                    accentColor="#F472B6"
                  />
                </div>
              </div>

              <button type="submit" disabled={formLoading || !message.trim() || !opensAt}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#F472B6] to-[#E879F9] px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(244,114,182,0.35)] transition hover:shadow-[0_4px_32px_rgba(244,114,182,0.5)] hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                {formLoading
                  ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg> Mengunci...</>
                  : <><span>💌</span> Kunci & Kirim</>
                }
              </button>
            </form>
          </div>
        </div>

        {/* Right — List */}
        <div className="space-y-6 lg:col-span-3">
          {loading ? (
            <div className="space-y-3">{[1,2].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-white/4" />)}</div>
          ) : (
            <>
              {/* Received */}
              {received.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#5C5470]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#F472B6] shadow-[0_0_6px_#F472B6]" />
                    Kapsul Untukmu ({received.length})
                  </p>
                  <div className="space-y-3">
                    {received.map((c) => (
                      <div key={c.id} onClick={c.status === "delivered" ? () => setOpeningCapsule(c) : undefined}
                        className={c.status === "delivered" ? "cursor-pointer" : ""}>
                        <MessageCard capsule={c} isSent={false} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent */}
              {sent.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#5C5470]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#818CF8] shadow-[0_0_6px_#818CF8]" />
                    Kapsul yang Kamu Kirim ({sent.length})
                  </p>
                  <div className="space-y-3">
                    {sent.map((c) => <MessageCard key={c.id} capsule={c} isSent />)}
                  </div>
                </div>
              )}

              {/* Empty */}
              {capsules.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
                  <div className="mb-4 text-6xl float">💌</div>
                  <p className="font-semibold text-[#9B93B0]">Belum ada kapsul</p>
                  <p className="mt-1 text-sm text-[#5C5470] max-w-xs">Tulis pesan pertama untuk partner — dia baru bisa membacanya di tanggal yang kamu pilih.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
