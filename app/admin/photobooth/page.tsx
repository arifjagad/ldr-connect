"use client";

import { useEffect, useState, useId, useRef, useMemo } from "react";
import Image from "next/image";
import type { PhotoboothTemplate, PhotoboothSlot } from "@/lib/types";

type GameSetting = {
  id: number;
  game_type: string;
  display_name: string;
  description: string;
  coin_cost: number;
  expires_in_minutes: number;
  is_active: boolean;
};

const DEFAULT_SLOTS_3: PhotoboothSlot[] = [
  { index: 1, x: 40, y: 60, width: 520, height: 500, rounded: 16 },
  { index: 2, x: 40, y: 590, width: 520, height: 500, rounded: 16 },
  { index: 3, x: 40, y: 1120, width: 520, height: 500, rounded: 16 },
];

/**
 * Algoritma Computer Vision / Connected Component Analysis
 * Otomatis mendeteksi area lubang transparan (alpha < 40) pada gambar frame PNG.
 */
function analyzeTransparentSlots(img: HTMLImageElement): PhotoboothSlot[] {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return [];

  // Downsample untuk pemrosesan BFS instan (max dimensi 800px)
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, sw, sw > 0 && sh > 0 ? sh : sw);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // Masking binary: 1 jika transparan (alpha < 45), 0 jika solid/berwarna
  const mask = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    const alpha = data[i * 4 + 3];
    if (alpha < 45) {
      mask[i] = 1;
    }
  }

  const visited = new Uint8Array(sw * sh);
  const rawBoxes: { minX: number; maxX: number; minY: number; maxY: number; area: number }[] = [];

  const minArea = sw * sh * 0.015; // Minimal 1.5% dari total canvas
  const maxArea = sw * sh * 0.9; // Abaikan jika memenuhi seluruh canvas

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = y * sw + x;
      if (mask[idx] === 1 && visited[idx] === 0) {
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let area = 0;

        const queue: number[] = [idx];
        visited[idx] = 1;
        let head = 0;

        while (head < queue.length) {
          const curr = queue[head++];
          const cx = curr % sw;
          const cy = Math.floor(curr / sw);
          area++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 4-Arah Tetangga
          const neighbors = [
            cy > 0 ? curr - sw : -1,
            cy < sh - 1 ? curr + sw : -1,
            cx > 0 ? curr - 1 : -1,
            cx < sw - 1 ? curr + 1 : -1,
          ];

          for (const n of neighbors) {
            if (n >= 0 && mask[n] === 1 && visited[n] === 0) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        const boxW = maxX - minX + 1;
        const boxH = maxY - minY + 1;

        if (area >= minArea && area <= maxArea && boxW >= sw * 0.12 && boxH >= sh * 0.04) {
          rawBoxes.push({ minX, maxX, minY, maxY, area });
        }
      }
    }
  }

  // Jika tidak terdeteksi lubang transparan (misal frame belum transparan), return fallback
  if (rawBoxes.length === 0) {
    return [];
  }

  // Kembalikan koordinat bounding box ke resolusi asli
  const slots: PhotoboothSlot[] = rawBoxes.map((b) => {
    const origX = Math.round(b.minX / scale);
    const origY = Math.round(b.minY / scale);
    const origW = Math.round((b.maxX - b.minX + 1) / scale);
    const origH = Math.round((b.maxY - b.minY + 1) / scale);
    return {
      index: 0,
      x: origX,
      y: origY,
      width: origW,
      height: origH,
      rounded: 16,
    };
  });

  // Urutkan slot: Atas ke Bawah (Y), lalu Kiri ke Kanan (X)
  const yTolerance = h * 0.04;
  slots.sort((a, b) => {
    if (Math.abs(a.y - b.y) > yTolerance) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  return slots.map((s, i) => ({ ...s, index: i + 1 }));
}

function detectAspectRatio(w: number, h: number): string {
  const ratio = h / w;
  if (Math.abs(ratio - 3.0) < 0.3) return "2:6";
  if (Math.abs(ratio - 1.5) < 0.25) return "4:6";
  if (Math.abs(ratio - 1.0) < 0.15) return "1:1";
  if (Math.abs(ratio - 0.67) < 0.15) return "6:4";
  return `${w}:${h}`;
}

export default function AdminPhotoboothPage() {
  const [templates, setTemplates] = useState<PhotoboothTemplate[]>([]);
  const [setting, setSetting] = useState<GameSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PhotoboothTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // File Upload State
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [detectingSlots, setDetectingSlots] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  // Form Fields
  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fImageUrl, setFImageUrl] = useState("");
  const [fThumbnailUrl, setFThumbnailUrl] = useState("");
  const [fAspectRatio, setFAspectRatio] = useState("2:6");
  const [fCanvasWidth, setFCanvasWidth] = useState(600);
  const [fCanvasHeight, setFCanvasHeight] = useState(1800);
  const [fPhotoCount, setFPhotoCount] = useState(3);
  const [fSlots, setFSlots] = useState<PhotoboothSlot[]>(DEFAULT_SLOTS_3);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(1);
  const [fIsActive, setFIsActive] = useState(true);
  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");
  const [jsonText, setJsonText] = useState(JSON.stringify(DEFAULT_SLOTS_3, null, 2));

  // Form ID Hooks
  const nameId = useId();
  const descId = useId();
  const imageId = useId();
  const thumbId = useId();
  const aspectId = useId();
  const widthId = useId();
  const heightId = useId();
  const countId = useId();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/photobooth/templates");
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data.templates || []);
        if (json.data.setting) {
          setSetting(json.data.setting);
        }
      }
    } catch {
      setToast({ ok: false, msg: "Gagal memuat data photobooth" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenCreate() {
    setEditingTemplate(null);
    setFName("");
    setFDesc("");
    setFImageUrl("");
    setFThumbnailUrl("");
    setFAspectRatio("2:6");
    setFCanvasWidth(600);
    setFCanvasHeight(1800);
    setFPhotoCount(3);
    setFSlots(DEFAULT_SLOTS_3);
    setSelectedSlotIndex(1);
    setJsonText(JSON.stringify(DEFAULT_SLOTS_3, null, 2));
    setFIsActive(true);
    setViewMode("visual");
    setShowModal(true);
  }

  function handleOpenEdit(t: PhotoboothTemplate) {
    setEditingTemplate(t);
    setFName(t.name);
    setFDesc(t.description || "");
    setFImageUrl(t.image_url);
    setFThumbnailUrl(t.thumbnail_url || "");
    setFAspectRatio(t.aspect_ratio);
    setFCanvasWidth(t.canvas_width);
    setFCanvasHeight(t.canvas_height);
    setFPhotoCount(t.photo_count);
    const slots = Array.isArray(t.slots) && t.slots.length > 0 ? t.slots : DEFAULT_SLOTS_3;
    setFSlots(slots);
    setSelectedSlotIndex(slots[0]?.index || 1);
    setJsonText(JSON.stringify(slots, null, 2));
    setFIsActive(t.is_active);
    setViewMode("visual");
    setShowModal(true);
  }

  // ── Auto-Detect Slot dari Image Frame PNG ───────────────────────────────────
  function runSlotDetection(imageUrl: string) {
    setDetectingSlots(true);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (w > 0 && h > 0) {
        setFCanvasWidth(w);
        setFCanvasHeight(h);
        setFAspectRatio(detectAspectRatio(w, h));

        const detected = analyzeTransparentSlots(img);
        if (detected.length > 0) {
          setFSlots(detected);
          setFPhotoCount(detected.length);
          setSelectedSlotIndex(1);
          setJsonText(JSON.stringify(detected, null, 2));
          setToast({
            ok: true,
            msg: `Otomatis mendeteksi ${detected.length} slot foto transparan (${w}×${h}px)!`,
          });
        } else {
          setToast({
            ok: false,
            msg: "Tidak menemukan lubang transparan pada PNG. Menggunakan konfigurasi standar.",
          });
        }
      }
      setDetectingSlots(false);
    };

    img.onerror = () => {
      setDetectingSlots(false);
      setToast({ ok: false, msg: "Gagal membaca gambar frame untuk deteksi slot." });
    };
  }

  // ── Upload Handler ke Supabase Storage ─────────────────────────────────────
  async function handleFileUpload(file: File, folder: "frames" | "thumbnails") {
    const isFrame = folder === "frames";
    if (isFrame) setUploadingImage(true);
    else setUploadingThumb(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/admin/photobooth/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Upload gagal");

      if (isFrame) {
        setFImageUrl(json.data.url);
        // Otomatis jalankan deteksi lubang slot foto
        runSlotDetection(json.data.url);
      } else {
        setFThumbnailUrl(json.data.url);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengunggah file";
      setToast({ ok: false, msg });
    } finally {
      if (isFrame) setUploadingImage(false);
      else setUploadingThumb(false);
    }
  }

  // ── Manual Slot Controls ───────────────────────────────────────────────────
  function handleUpdateSlot(index: number, key: keyof PhotoboothSlot, value: number) {
    setFSlots((prev) => {
      const next = prev.map((s) => (s.index === index ? { ...s, [key]: value } : s));
      setJsonText(JSON.stringify(next, null, 2));
      return next;
    });
  }

  function handleAddSlot() {
    const newIdx = fSlots.length > 0 ? Math.max(...fSlots.map((s) => s.index)) + 1 : 1;
    const last = fSlots[fSlots.length - 1];
    const newSlot: PhotoboothSlot = last
      ? {
          index: newIdx,
          x: last.x,
          y: Math.min(last.y + last.height + 40, fCanvasHeight - 200),
          width: last.width,
          height: last.height,
          rounded: last.rounded || 16,
        }
      : {
          index: newIdx,
          x: 40,
          y: 40,
          width: Math.round(fCanvasWidth * 0.85),
          height: Math.round(fCanvasWidth * 0.8),
          rounded: 16,
        };

    const next = [...fSlots, newSlot];
    setFSlots(next);
    setFPhotoCount(next.length);
    setSelectedSlotIndex(newIdx);
    setJsonText(JSON.stringify(next, null, 2));
  }

  function handleRemoveSlot(index: number) {
    if (fSlots.length <= 1) {
      setToast({ ok: false, msg: "Minimal harus ada 1 slot foto" });
      return;
    }
    const filtered = fSlots.filter((s) => s.index !== index);
    const reindexed = filtered.map((s, i) => ({ ...s, index: i + 1 }));
    setFSlots(reindexed);
    setFPhotoCount(reindexed.length);
    setSelectedSlotIndex(reindexed[0]?.index || 1);
    setJsonText(JSON.stringify(reindexed, null, 2));
  }

  function handleJsonSync(text: string) {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        setFSlots(parsed);
        setFPhotoCount(parsed.length);
        if (parsed.length > 0 && !parsed.some((s) => s.index === selectedSlotIndex)) {
          setSelectedSlotIndex(parsed[0].index);
        }
      }
    } catch {
      // ignore while typing invalid JSON
    }
  }

  // ── Submit Template ────────────────────────────────────────────────────────
  async function handleSubmitTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let finalSlots: PhotoboothSlot[] = fSlots;
    if (viewMode === "json") {
      try {
        finalSlots = JSON.parse(jsonText);
        if (!Array.isArray(finalSlots)) throw new Error("Slots harus array");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "JSON slots tidak valid";
        setToast({ ok: false, msg });
        setSubmitting(false);
        return;
      }
    }

    if (finalSlots.length === 0) {
      setToast({ ok: false, msg: "Template harus memiliki minimal 1 slot foto" });
      setSubmitting(false);
      return;
    }

    const payload = {
      name: fName.trim(),
      description: fDesc.trim() || null,
      image_url: fImageUrl.trim(),
      thumbnail_url: fThumbnailUrl.trim() || null,
      aspect_ratio: fAspectRatio.trim(),
      canvas_width: Number(fCanvasWidth),
      canvas_height: Number(fCanvasHeight),
      photo_count: Number(finalSlots.length), // jumlah slot = jumlah foto
      slots: finalSlots,
      is_active: fIsActive,
    };

    try {
      const url = editingTemplate
        ? `/api/admin/photobooth/templates/${editingTemplate.id}`
        : "/api/admin/photobooth/templates";
      const method = editingTemplate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal menyimpan template");

      setToast({ ok: true, msg: json.message });
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      setToast({ ok: false, msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(template: PhotoboothTemplate) {
    try {
      const res = await fetch(`/api/admin/photobooth/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !template.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setToast({ ok: true, msg: `Template ${template.is_active ? "dinonaktifkan" : "diaktifkan"}` });
      setTemplates((prev) =>
        prev.map((item) => (item.id === template.id ? { ...item, is_active: !item.is_active } : item))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal update status";
      setToast({ ok: false, msg });
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/admin/photobooth/templates/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setToast({ ok: true, msg: "Template berhasil dihapus" });
      setTemplates((prev) => prev.filter((item) => item.id !== id));
      setDeleteId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus template";
      setToast({ ok: false, msg });
    }
  }

  const activeSlot = useMemo(
    () => fSlots.find((s) => s.index === selectedSlotIndex) || fSlots[0],
    [fSlots, selectedSlotIndex]
  );

  return (
    <div className="min-h-screen bg-[#0D0D10] px-8 py-8 text-[#FFF5F8]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3.5 text-xs font-semibold shadow-2xl backdrop-blur-md transition ${
            toast.ok
              ? "border-emerald-500/30 bg-emerald-950/80 text-emerald-300"
              : "border-rose-500/30 bg-rose-950/80 text-rose-300"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
            {toast.ok ? "✓" : "✕"}
          </span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/6 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF3D7F]/20 to-[#FF6B9D]/10 text-[#FF6B9D]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Photobooth Studio</h1>
              <p className="text-xs text-[#9B93B0]">
                Upload frame PNG transparan — lubang slot foto dan jumlah foto dideteksi otomatis.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF3D7F] to-[#FF6B9D] px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_20px_rgba(255,61,127,0.35)] transition hover:opacity-90 active:scale-98"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Template Frame
        </button>
      </div>

      {/* Game Info Bar */}
      {setting && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-white/6 bg-gradient-to-r from-[#17171C] via-[#131317] to-[#17171C] p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3D7F] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF6B9D]" />
              </span>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">Sesi Virtual Photobooth</h2>
                <p className="text-[11px] text-[#9B93B0]">Kamera ganda real-time untuk pasangan LDR</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/3 px-3.5 py-1.5">
                <span className="text-[#5C5470]">Biaya Masuk:</span>
                <span className="font-bold text-[#FBBF24]">{setting.coin_cost} Coin</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/3 px-3.5 py-1.5">
                <span className="text-[#5C5470]">Batas Waktu:</span>
                <span className="font-semibold text-white">{setting.expires_in_minutes} Menit</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[#FF3D7F]/20 bg-[#FF3D7F]/5 px-3.5 py-1.5">
                <span className="text-[#9B93B0]">Storage Bucket:</span>
                <span className="font-mono font-bold text-[#FF6B9D]">photobooth</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF6B9D]">Template Tersedia</span>
          <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-semibold text-[#9B93B0]">
            {templates.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/6 bg-[#131317] py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF3D7F] border-t-transparent" />
          <p className="mt-3 text-xs text-[#9B93B0]">Memuat koleksi template photobooth...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#131317] py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/4 text-2xl text-[#9B93B0]">
            📷
          </div>
          <p className="text-sm font-semibold text-white">Belum Ada Template</p>
          <p className="mt-1 text-xs text-[#5C5470]">Upload template frame PNG pertama Anda.</p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 rounded-xl bg-white/6 px-4 py-2 text-xs font-semibold text-[#FF6B9D] transition hover:bg-white/10"
          >
            + Buat Template Sekarang
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className={`group relative flex flex-col justify-between rounded-2xl border bg-[#131317] p-4 transition duration-200 ${
                tmpl.is_active
                  ? "border-white/6 hover:border-[#FF3D7F]/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                  : "border-white/4 opacity-60"
              }`}
            >
              <div>
                {/* Title & Badge */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-white group-hover:text-[#FF6B9D] transition">
                      {tmpl.name}
                    </h3>
                    <p className="truncate text-[11px] text-[#5C5470]">
                      {tmpl.description || "Tanpa deskripsi"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      tmpl.is_active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-white/4 text-[#5C5470]"
                    }`}
                  >
                    {tmpl.is_active ? "Aktif" : "Non-aktif"}
                  </span>
                </div>

                {/* Visual Strip Preview Card */}
                <div className="relative mb-4 flex h-60 w-full items-center justify-center overflow-hidden rounded-xl border border-white/6 bg-[#09090B] p-2">
                  {/* Checkerboard Pattern */}
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage: `radial-gradient(#FFF 1px, transparent 1px)`,
                      backgroundSize: "8px 8px",
                    }}
                  />

                  {/* Scaled Frame Strip */}
                  <div
                    className="relative overflow-hidden rounded-md border border-white/10 shadow-2xl"
                    style={{
                      height: "220px",
                      width: `${(220 * (tmpl.canvas_width || 600)) / (tmpl.canvas_height || 1800)}px`,
                      maxHeight: "220px",
                    }}
                  >
                    {/* Simulated Slots Inside Strip */}
                    {(tmpl.slots || []).map((s) => {
                      const stripW = (220 * (tmpl.canvas_width || 600)) / (tmpl.canvas_height || 1800);
                      const scale = stripW / (tmpl.canvas_width || 600);
                      return (
                        <div
                          key={s.index}
                          className="absolute flex items-center justify-center border border-dashed border-[#FF3D7F]/60 bg-[#FF3D7F]/10 text-[9px] font-bold text-[#FF6B9D]"
                          style={{
                            left: `${s.x * scale}px`,
                            top: `${s.y * scale}px`,
                            width: `${s.width * scale}px`,
                            height: `${s.height * scale}px`,
                            borderRadius: `${(s.rounded || 8) * scale}px`,
                          }}
                        >
                          {s.index}
                        </div>
                      );
                    })}

                    {/* PNG Overlay */}
                    {tmpl.image_url && (
                      <Image
                        src={tmpl.thumbnail_url || tmpl.image_url}
                        alt={tmpl.name}
                        fill
                        className="pointer-events-none object-contain"
                        unoptimized
                      />
                    )}
                  </div>
                </div>

                {/* Specs Details */}
                <div className="space-y-1.5 rounded-xl border border-white/4 bg-white/2 p-3 text-[11px]">
                  <div className="flex justify-between text-[#9B93B0]">
                    <span className="text-[#5C5470]">Rasio &amp; Slot</span>
                    <span className="font-semibold text-white">
                      {tmpl.aspect_ratio} • {tmpl.photo_count} Foto
                    </span>
                  </div>
                  <div className="flex justify-between text-[#9B93B0]">
                    <span className="text-[#5C5470]">Resolusi Canvas</span>
                    <span className="font-mono text-[10px] text-white">
                      {tmpl.canvas_width} × {tmpl.canvas_height} px
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center gap-1.5 border-t border-white/6 pt-3">
                <button
                  type="button"
                  onClick={() => handleToggleActive(tmpl)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                    tmpl.is_active
                      ? "bg-white/4 text-[#9B93B0] hover:bg-white/8 hover:text-white"
                      : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  }`}
                >
                  {tmpl.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(tmpl)}
                  className="rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/8 hover:border-white/15"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(tmpl.id)}
                  className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20"
                  title="Hapus"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: Visual Builder Studio ───────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => !submitting && setShowModal(false)}
          />

          <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#131317] shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF3D7F]/10 text-[#FF6B9D]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingTemplate ? "Edit Template Photobooth" : "Buat Template Photobooth Baru"}
                  </h2>
                  <p className="text-[11px] text-[#9B93B0]">
                    Upload PNG transparan — posisi slot foto dan resolusi terdeteksi otomatis.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl p-2 text-[#5C5470] transition hover:bg-white/6 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body with 2 Columns: Live Preview (Left) & Form Controls (Right) */}
            <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row">
              {/* LEFT: Live Interactive Canvas Preview */}
              <div className="flex flex-col items-center justify-center border-b border-white/8 bg-[#09090B] p-6 lg:w-[420px] lg:border-b-0 lg:border-r">
                <div className="mb-3 flex w-full items-center justify-between text-xs text-[#9B93B0]">
                  <span className="font-semibold uppercase tracking-wider text-[#FF6B9D]">Live Canvas Preview</span>
                  <span className="font-mono text-[10px]">
                    {fCanvasWidth} × {fCanvasHeight} px
                  </span>
                </div>

                {/* The Strip Visualizer */}
                <div className="relative flex h-[480px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-[#131317]/50 p-4">
                  {/* Checkerboard */}
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage: `radial-gradient(#FFF 1px, transparent 1px)`,
                      backgroundSize: "10px 10px",
                    }}
                  />

                  {/* Responsive Scaled Canvas Box */}
                  <div
                    className="relative overflow-hidden rounded-xl border border-white/20 bg-[#09090B] shadow-2xl transition-all"
                    style={{
                      height: "440px",
                      width: `${Math.min(320, (440 * (fCanvasWidth || 600)) / (fCanvasHeight || 1800))}px`,
                    }}
                  >
                    {/* Interactive Slots Box */}
                    {fSlots.map((s) => {
                      const currentW = Math.min(320, (440 * (fCanvasWidth || 600)) / (fCanvasHeight || 1800));
                      const scale = currentW / (fCanvasWidth || 600);
                      const isSelected = s.index === selectedSlotIndex;

                      return (
                        <div
                          key={s.index}
                          onClick={() => setSelectedSlotIndex(s.index)}
                          className={`absolute flex cursor-pointer items-center justify-center transition-all ${
                            isSelected
                              ? "border-2 border-[#FF3D7F] bg-[#FF3D7F]/25 text-[#FFF5F8] shadow-[0_0_15px_rgba(255,61,127,0.5)] z-20"
                              : "border border-dashed border-white/50 bg-white/10 text-[#9B93B0] hover:border-[#FF6B9D] z-10"
                          }`}
                          style={{
                            left: `${s.x * scale}px`,
                            top: `${s.y * scale}px`,
                            width: `${s.width * scale}px`,
                            height: `${s.height * scale}px`,
                            borderRadius: `${(s.rounded || 8) * scale}px`,
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black">#{s.index}</span>
                            <span className="text-[9px] opacity-75">{s.width}×{s.height}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Transparent Frame Overlay */}
                    {fImageUrl ? (
                      <Image
                        src={fImageUrl}
                        alt="Frame Preview"
                        fill
                        className="pointer-events-none object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="pointer-events-none flex h-full items-center justify-center p-4 text-center text-[11px] text-[#5C5470]">
                        Upload frame PNG transparan untuk deteksi otomatis
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex w-full items-center justify-between text-[11px] text-[#5C5470]">
                  <span>Klik slot pada preview untuk edit presisi</span>
                  <span className="rounded bg-[#FF3D7F]/15 px-2 py-0.5 font-bold text-[#FF6B9D]">
                    {fSlots.length} Slot ({fSlots.length} Foto)
                  </span>
                </div>
              </div>

              {/* RIGHT: Detailed Configuration Settings */}
              <div className="flex-1 p-6">
                <form onSubmit={handleSubmitTemplate} className="space-y-5">
                  {/* Basic Info */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={nameId} className="mb-1.5 block text-xs font-semibold text-white">
                        Nama Template <span className="text-[#FF3D7F]">*</span>
                      </label>
                      <input
                        id={nameId}
                        type="text"
                        required
                        value={fName}
                        onChange={(e) => setFName(e.target.value)}
                        placeholder="Contoh: Romantic Pastel Strip"
                        className="w-full rounded-xl border border-white/8 bg-white/3 px-3.5 py-2.5 text-xs text-white placeholder-[#5C5470] transition focus:border-[#FF3D7F] focus:bg-white/6 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor={aspectId} className="mb-1.5 block text-xs font-semibold text-white">
                        Aspek Rasio (Strip)
                      </label>
                      <div className="flex gap-2">
                        {["2:6", "4:6", "1:1"].map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setFAspectRatio(ratio)}
                            className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${
                              fAspectRatio === ratio
                                ? "border-[#FF3D7F] bg-[#FF3D7F]/15 text-[#FF6B9D]"
                                : "border-white/8 bg-white/3 text-[#9B93B0] hover:bg-white/6"
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                        <input
                          id={aspectId}
                          type="text"
                          value={fAspectRatio}
                          onChange={(e) => setFAspectRatio(e.target.value)}
                          placeholder="Custom"
                          className="w-20 rounded-xl border border-white/8 bg-white/3 px-2.5 py-2 text-center text-xs text-white focus:border-[#FF3D7F] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor={descId} className="mb-1.5 block text-xs font-semibold text-white">
                      Deskripsi Template (Opsional)
                    </label>
                    <input
                      id={descId}
                      type="text"
                      value={fDesc}
                      onChange={(e) => setFDesc(e.target.value)}
                      placeholder="Template strip bernuansa vintage dengan frame 3 slot vertikal..."
                      className="w-full rounded-xl border border-white/8 bg-white/3 px-3.5 py-2.5 text-xs text-white placeholder-[#5C5470] transition focus:border-[#FF3D7F] focus:bg-white/6 focus:outline-none"
                    />
                  </div>

                  {/* Supabase Storage Upload Box & Auto-Detect Trigger */}
                  <div className="rounded-2xl border border-white/8 bg-[#17171C] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <label htmlFor={imageId} className="block text-xs font-bold text-white">
                          Frame PNG Transparan (Supabase Bucket) <span className="text-[#FF3D7F]">*</span>
                        </label>
                        <p className="text-[11px] text-[#9B93B0]">
                          Sistem akan memindai lubang transparan dan mengisi koordinat slot otomatis.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {fImageUrl && (
                          <button
                            type="button"
                            onClick={() => runSlotDetection(fImageUrl)}
                            disabled={detectingSlots}
                            className="flex items-center gap-1.5 rounded-xl border border-[#FF3D7F]/30 bg-[#FF3D7F]/10 px-3 py-2 text-xs font-bold text-[#FF6B9D] transition hover:bg-[#FF3D7F]/20 disabled:opacity-50"
                            title="Pindai ulang lubang transparan"
                          >
                            {detectingSlots ? "Memindai..." : "🔍 Deteksi Ulang"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={uploadingImage || detectingSlots}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF3D7F] to-[#FF6B9D] px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
                        >
                          {uploadingImage || detectingSlots ? (
                            <>
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              {uploadingImage ? "Mengunggah..." : "Mendeteksi Slot..."}
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                              Upload PNG Frame
                            </>
                          )}
                        </button>
                      </div>

                      <input
                        type="file"
                        ref={imageInputRef}
                        accept="image/png,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "frames");
                        }}
                      />
                    </div>

                    <input
                      id={imageId}
                      type="text"
                      required
                      value={fImageUrl}
                      onChange={(e) => {
                        setFImageUrl(e.target.value);
                        if (e.target.value.startsWith("http")) {
                          runSlotDetection(e.target.value);
                        }
                      }}
                      placeholder="https://...supabase.co/storage/v1/object/public/photobooth/frames/..."
                      className="w-full rounded-xl border border-white/8 bg-black/40 px-3 py-2 font-mono text-[11px] text-[#FF6B9D] placeholder-[#5C5470] focus:border-[#FF3D7F] focus:outline-none"
                    />
                  </div>

                  {/* Thumbnail Frame (Optional) */}
                  <div className="rounded-2xl border border-white/8 bg-[#17171C] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <label htmlFor={thumbId} className="block text-xs font-bold text-white">
                          Thumbnail Frame (Opsional)
                        </label>
                        <p className="text-[11px] text-[#5C5470]">
                          Thumbnail kecil untuk katalog pemilih template di game.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => thumbInputRef.current?.click()}
                        disabled={uploadingThumb}
                        className="rounded-xl border border-white/8 bg-white/4 px-3 py-1.5 text-xs font-semibold text-[#9B93B0] transition hover:bg-white/8 disabled:opacity-50"
                      >
                        {uploadingThumb ? "Mengunggah..." : "Upload Thumbnail"}
                      </button>

                      <input
                        type="file"
                        ref={thumbInputRef}
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "thumbnails");
                        }}
                      />
                    </div>

                    <input
                      id={thumbId}
                      type="text"
                      value={fThumbnailUrl}
                      onChange={(e) => setFThumbnailUrl(e.target.value)}
                      placeholder="https://.../thumbnails/..."
                      className="w-full rounded-xl border border-white/8 bg-black/40 px-3 py-2 font-mono text-[11px] text-[#9B93B0] placeholder-[#5C5470] focus:border-[#FF3D7F] focus:outline-none"
                    />
                  </div>

                  {/* Canvas Resolution & Auto Calculated Specs */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor={widthId} className="mb-1 block text-[11px] font-semibold text-[#9B93B0]">
                        Width (px)
                      </label>
                      <input
                        id={widthId}
                        type="number"
                        required
                        value={fCanvasWidth}
                        onChange={(e) => setFCanvasWidth(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs font-semibold text-white focus:border-[#FF3D7F] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor={heightId} className="mb-1 block text-[11px] font-semibold text-[#9B93B0]">
                        Height (px)
                      </label>
                      <input
                        id={heightId}
                        type="number"
                        required
                        value={fCanvasHeight}
                        onChange={(e) => setFCanvasHeight(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs font-semibold text-white focus:border-[#FF3D7F] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor={countId} className="mb-1 block text-[11px] font-semibold text-[#9B93B0]">
                        Jumlah Foto (= Slot)
                      </label>
                      <input
                        id={countId}
                        type="number"
                        disabled
                        value={fSlots.length}
                        className="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-xs font-bold text-[#FF6B9D] opacity-90 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Slot Coordinator: Visual Mode vs JSON Mode */}
                  <div className="rounded-2xl border border-white/8 bg-[#17171C] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Hasil Deteksi Slot Foto</span>
                        <span className="rounded bg-[#FF3D7F]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF6B9D]">
                          {fSlots.length} Slot Terdeteksi
                        </span>
                      </div>

                      {/* Mode Toggle */}
                      <div className="flex rounded-xl border border-white/8 bg-black/40 p-0.5">
                        <button
                          type="button"
                          onClick={() => setViewMode("visual")}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                            viewMode === "visual"
                              ? "bg-[#FF3D7F] text-white shadow-sm"
                              : "text-[#5C5470] hover:text-[#9B93B0]"
                          }`}
                        >
                          Visual
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setJsonText(JSON.stringify(fSlots, null, 2));
                            setViewMode("json");
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                            viewMode === "json"
                              ? "bg-[#FF3D7F] text-white shadow-sm"
                              : "text-[#5C5470] hover:text-[#9B93B0]"
                          }`}
                        >
                          JSON Code
                        </button>
                      </div>
                    </div>

                    {viewMode === "visual" ? (
                      <div className="space-y-4">
                        {/* Slot Tabs */}
                        <div className="flex flex-wrap items-center gap-2 border-b border-white/6 pb-3">
                          {fSlots.map((s) => (
                            <button
                              key={s.index}
                              type="button"
                              onClick={() => setSelectedSlotIndex(s.index)}
                              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                                s.index === selectedSlotIndex
                                  ? "border-[#FF3D7F] bg-[#FF3D7F]/15 text-[#FF6B9D]"
                                  : "border-white/8 bg-white/3 text-[#9B93B0] hover:bg-white/6"
                              }`}
                            >
                              <span>Slot #{s.index}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={handleAddSlot}
                            className="flex items-center gap-1 rounded-xl border border-dashed border-white/15 bg-white/2 px-3 py-1.5 text-xs font-semibold text-[#9B93B0] hover:border-[#FF3D7F] hover:text-[#FF6B9D]"
                          >
                            + Tambah Slot
                          </button>
                        </div>

                        {/* Selected Slot Parameter Controls */}
                        {activeSlot && (
                          <div className="space-y-3 rounded-xl border border-white/6 bg-black/30 p-3.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">
                                Koordinat Slot #{activeSlot.index} (Bisa Disesuaikan)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(activeSlot.index)}
                                className="text-[11px] font-semibold text-rose-400 hover:underline"
                              >
                                Hapus Slot
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                              <div>
                                <label className="mb-1 block text-[10px] text-[#5C5470]">X (px)</label>
                                <input
                                  type="number"
                                  value={activeSlot.x}
                                  onChange={(e) => handleUpdateSlot(activeSlot.index, "x", Number(e.target.value))}
                                  className="w-full rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-[#FF3D7F] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] text-[#5C5470]">Y (px)</label>
                                <input
                                  type="number"
                                  value={activeSlot.y}
                                  onChange={(e) => handleUpdateSlot(activeSlot.index, "y", Number(e.target.value))}
                                  className="w-full rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-[#FF3D7F] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] text-[#5C5470]">Width (px)</label>
                                <input
                                  type="number"
                                  value={activeSlot.width}
                                  onChange={(e) => handleUpdateSlot(activeSlot.index, "width", Number(e.target.value))}
                                  className="w-full rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-[#FF3D7F] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] text-[#5C5470]">Height (px)</label>
                                <input
                                  type="number"
                                  value={activeSlot.height}
                                  onChange={(e) => handleUpdateSlot(activeSlot.index, "height", Number(e.target.value))}
                                  className="w-full rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-[#FF3D7F] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] text-[#5C5470]">Radius (px)</label>
                                <input
                                  type="number"
                                  value={activeSlot.rounded ?? 16}
                                  onChange={(e) => handleUpdateSlot(activeSlot.index, "rounded", Number(e.target.value))}
                                  className="w-full rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-[#FF3D7F] focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <textarea
                          rows={7}
                          value={jsonText}
                          onChange={(e) => handleJsonSync(e.target.value)}
                          className="w-full rounded-xl border border-white/8 bg-black/60 p-3 font-mono text-xs text-[#FFF5F8] focus:border-[#FF3D7F] focus:outline-none"
                        />
                        <p className="mt-1 text-[10px] text-[#5C5470]">
                          Format: <code>[{`{"index": 1, "x": 40, "y": 60, "width": 520, "height": 500, "rounded": 16}`}]</code>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="form-active"
                      checked={fIsActive}
                      onChange={(e) => setFIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 accent-[#FF3D7F]"
                    />
                    <label htmlFor="form-active" className="cursor-pointer text-xs font-semibold text-white">
                      Aktifkan template ini agar dapat dipilih pemain di game
                    </label>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="flex items-center justify-end gap-2.5 border-t border-white/8 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      disabled={submitting}
                      className="rounded-xl border border-white/8 bg-white/4 px-4 py-2 text-xs font-semibold text-[#9B93B0] transition hover:bg-white/8 hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF3D7F] to-[#FF6B9D] px-6 py-2 text-xs font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Menyimpan...
                        </>
                      ) : editingTemplate ? (
                        "Simpan Perubahan"
                      ) : (
                        "Buat Template"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Delete Confirmation ────────────────────────────────────────── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-rose-500/20 bg-[#131317] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-xl text-rose-400">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white">Hapus Template?</h3>
            <p className="mt-1 text-xs text-[#9B93B0]">
              Template frame ini akan dihapus permanen dari database.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-xl border border-white/8 bg-white/4 py-2 text-xs font-semibold text-[#9B93B0] hover:bg-white/8"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-900/40"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
