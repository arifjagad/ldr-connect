"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";
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
  const colors = ["#C84B31", "#D97706", "#10B981", "#4F46E5", "#E07A5F", "#F59E0B"];

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
  const openDate = new Date(dateStr + "T00:00:00");
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return Math.ceil((openDate.getTime() - todayMidnight.getTime()) / 86400000);
}

function formatDate(d: string) {
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
    <div className="relative flex flex-col items-center justify-center py-10">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" />

      {/* CSS Keyframes */}
      <style>{`
        @keyframes shake { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-6deg)} 40%{transform:rotate(6deg)} 60%{transform:rotate(-4deg)} 80%{transform:rotate(4deg)} }
        @keyframes flap  { 0%{transform:rotateX(0deg)} 100%{transform:rotateX(-180deg)} }
        @keyframes rise  { 0%{transform:translateY(60px);opacity:0} 100%{transform:translateY(-20px);opacity:1} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(200,75,49,0.2)} 50%{box-shadow:0 0 40px rgba(200,75,49,0.4), 0 0 60px rgba(224,122,95,0.3)} }
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
          style={{ background: "linear-gradient(135deg, #FCFBF7 0%, #F5F5F4 50%, #FDF4F2 100%)", borderColor: "#C84B31" }}>

          {/* Envelope bottom triangle */}
          <div className="absolute bottom-0 left-0 right-0 h-0 border-x-140 border-b-100 border-x-transparent"
            style={{ borderBottomColor: "#C84B31", opacity: 0.2 }} />

          {/* Left flap */}
          <div className="absolute left-0 top-0 bottom-0 w-0 border-y-100 border-l-140 border-y-transparent"
            style={{ borderLeftColor: "rgba(200,75,49,0.1)" }} />
          {/* Right flap */}
          <div className="absolute right-0 top-0 bottom-0 w-0 border-y-100 border-r-140 border-y-transparent"
            style={{ borderRightColor: "rgba(224,122,95,0.1)" }} />

          {/* Top flap — animates open */}
          <div className="absolute top-0 left-0 right-0 origin-top"
            style={{
              height: 100,
              animation: phase === "opening" || phase === "letter" ? "flap 0.8s ease forwards" : "none",
              transformStyle: "preserve-3d",
              zIndex: 10,
            }}>
            <div className="absolute inset-0 w-0 border-x-140 border-t-100 border-x-transparent mx-auto"
              style={{ borderTopColor: "#C84B31", opacity: 0.85 }} />
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
          <div className="absolute -top-24 left-4 right-4 rounded-2xl border border-[#E7E5E4] bg-white p-4 text-center shadow-xl"
            style={{ animation: "rise 0.8s ease forwards" }}>
            <div className="text-2xl mb-1">✉️</div>
            <p className="text-xs text-[#C84B31] font-bold">Membuka kapsul...</p>
          </div>
        )}
      </div>

      {/* Label & hint */}
      {phase === "idle" && (
        <div className="mt-8 text-center">
          <p className="font-serif text-xl font-bold text-[#1F1D1B]">Tap untuk membuka 💌</p>
          <p className="mt-1 text-xs text-[#78716C]">Kapsul sudah menunggumu</p>
        </div>
      )}

      {phase !== "idle" && phase !== "reading" && (
        <p className="mt-8 text-xs font-semibold text-[#C84B31] animate-pulse">Sedang membuka pesan rahasia...</p>
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
      isOpened ? "border-[#10B981]/20 bg-[#EBF9EB]/30"
      : isDelivered ? "border-[#FBDCD5] bg-[#FDF4F2] shadow-xl shadow-black/2"
      : "border-[#E7E5E4] bg-white shadow-xl shadow-black/2"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shrink-0 border ${
            isOpened ? "bg-white border-[#10B981]/30"
            : isDelivered ? "bg-white border-[#FBDCD5]"
            : "bg-[#FCFBF7] border-[#E7E5E4]"
          }`}>
            {isOpened ? "✅" : isDelivered ? "💌" : "🔒"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-[#1F1D1B] text-sm">
                {isSent ? "Kapsul ke Partner" : "Kapsul dari Partner"}
              </p>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                isOpened ? "bg-[#EBF9EB] text-[#10B981] border-[#10B981]/20"
                : isDelivered ? "bg-[#FDF4F2] text-[#C84B31] border-[#FBDCD5]"
                : "bg-[#F5F5F4] text-[#78716C] border-[#E7E5E4]"
              }`}>
                {isOpened ? "Sudah Dibuka" : isDelivered ? "Siap dibuka!" : "Terkunci"}
              </span>
            </div>
            <p className="text-xs text-[#78716C] mt-0.5">
              {isOpened ? `Dibuka ${formatDate(capsule.opened_at!)}` : `Terbuka: ${formatDate(capsule.opens_at)}`}
            </p>
          </div>
        </div>

        {/* Countdown / days */}
        {!isOpened && !isDelivered && (
          <div className="shrink-0 text-right">
            <p className="font-mono text-2xl font-bold tabular-nums text-[#1F1D1B]">{days}</p>
            <p className="text-[10px] font-semibold text-[#78716C]">hari lagi</p>
          </div>
        )}
      </div>

      {/* Progress bar countdown */}
      {!isOpened && !isDelivered && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-[#F5F5F4] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#C84B31] transition-all duration-700"
              style={{ width: `${Math.max(5, 100 - (days / 365) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Opened message preview */}
      {isOpened && capsule.message && (
        <div className="mt-4 rounded-xl border border-[#E7E5E4] bg-white p-4">
          <p className="text-xs text-[#1F1D1B] leading-relaxed italic">"{capsule.message}"</p>
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

    const confirmed = await dialog.confirm({
      title: "Kunci Kapsul Waktu?",
      description: `Pesan ini akan dikunci dan hanya dapat dibuka oleh pasangan pada tanggal ${formatDate(opensAt)}. Pesan tidak dapat diedit setelah dikunci.`,
      confirmText: "Ya, Kunci & Kirim",
      cancelText: "Periksa Lagi",
    });

    if (!confirmed) return;

    setFormLoading(true);
    const res = await fetch("/api/capsule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, opens_at: opensAt }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Kapsul Terkunci!", "Pesan rahasia berhasil disimpan dan dikunci.");
      setMessage(""); setOpensAt(""); await loadCapsules();
    } else {
      toast.error("Gagal Mengirim", json.message || "Terjadi kesalahan saat mengunci kapsul.");
    }
    setFormLoading(false);
  }

  function handleOpened(data: Capsule) {
    setCapsules((prev) => prev.map((c) => c.id === data.id ? data : c));
    setOpeningCapsule(null);
    toast.success("Kapsul Terbuka! 🎉", "Pesan dari pasangan berhasil dibuka.");
  }

  // Min date: besok WIB
  const tomorrowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  tomorrowWib.setDate(tomorrowWib.getDate() + 1);
  const minDate = tomorrowWib.toISOString().split("T")[0];

  const received = capsules.filter((c) => c.receiver_id === userId);
  const sent = capsules.filter((c) => c.sender_id === userId);
  const deliveredCapsule = received.find((c) => c.status === "delivered");

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Opening Modal */}
      {openingCapsule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-[#E7E5E4] bg-white p-8 shadow-2xl">
            <CapsuleOpeningScene capsule={openingCapsule} onOpened={handleOpened} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          <span>💌</span>
          <span>Surat Masa Depan</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
          Kapsul Waktu
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#78716C]">
          Kirim pesan rahasia yang terkunci — dibuka tepat saat tanggal yang kamu tentukan tiba.
        </p>
      </div>

      {/* Banner — jika ada kapsul yang bisa dibuka */}
      {deliveredCapsule && (
        <div
          className="mb-8 relative overflow-hidden rounded-2xl border border-[#FBDCD5] bg-[#FDF4F2] p-6 cursor-pointer group shadow-xl shadow-black/2"
          onClick={() => setOpeningCapsule(deliveredCapsule)}
        >
          <div className="relative flex items-center gap-5">
            <div className="text-4xl">💌</div>
            <div>
              <p className="font-serif text-lg font-bold text-[#1F1D1B]">Kapsul sudah bisa dibuka!</p>
              <p className="text-xs text-[#78716C] mt-0.5">Partner mengirimkan pesan istimewa untukmu. Tap di sini untuk membukanya sekarang.</p>
            </div>
            <svg className="ml-auto shrink-0 text-[#C84B31] transition group-hover:translate-x-1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left — Form */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
                <span className="text-lg">✉️</span>
              </div>
              <div>
                <p className="font-serif text-lg font-bold text-[#1F1D1B]">Kirim Kapsul Baru</p>
                <p className="text-xs text-[#78716C]">Pesan yang dibuka di masa depan</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]" htmlFor="cap-msg">
                  Tuliskan pesanmu
                </label>
                <textarea
                  id="cap-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  maxLength={2000}
                  placeholder="Tulis pesan dari hati... Partner baru bisa membacanya di tanggal pembukaan."
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-3 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition leading-relaxed"
                />
                <p className="mt-1 text-right text-[10px] font-semibold text-[#78716C]">{message.length}/2000</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]" htmlFor="cap-date">
                  Tanggal kapsul terbuka
                </label>
                <div className="mt-1.5">
                  <DatePicker
                    value={opensAt}
                    onChange={setOpensAt}
                    min={minDate}
                    placeholder="Pilih tanggal pembukaan..."
                    accentColor="#C84B31"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading || !message.trim() || !opensAt}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-4 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {formLoading ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Mengunci...
                  </>
                ) : (
                  <>
                    <span>💌</span> Kunci & Kirim Kapsul
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right — List */}
        <div className="space-y-6 lg:col-span-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div key={n} className="h-28 animate-pulse rounded-2xl bg-white border border-[#E7E5E4]" />
              ))}
            </div>
          ) : (
            <>
              {/* Received */}
              {received.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C84B31]" />
                    Kapsul Untukmu ({received.length})
                  </p>
                  <div className="space-y-3">
                    {received.map((c) => (
                      <div
                        key={c.id}
                        onClick={c.status === "delivered" ? () => setOpeningCapsule(c) : undefined}
                        className={c.status === "delivered" ? "cursor-pointer" : ""}
                      >
                        <MessageCard capsule={c} isSent={false} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent */}
              {sent.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5]" />
                    Kapsul yang Kamu Kirim ({sent.length})
                  </p>
                  <div className="space-y-3">
                    {sent.map((c) => (
                      <MessageCard key={c.id} capsule={c} isSent />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty */}
              {capsules.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E5E4] bg-white py-16 text-center">
                  <div className="mb-3 text-4xl">💌</div>
                  <p className="text-sm font-bold text-[#1F1D1B]">Belum ada kapsul waktu</p>
                  <p className="mt-1 text-xs text-[#78716C] max-w-xs">
                    Tulis pesan rahasia pertama untuk pasanganmu — ia baru bisa membacanya saat tanggal pilihanmu tiba!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
