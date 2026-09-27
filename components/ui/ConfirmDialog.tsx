"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" untuk aksi destruktif (merah), "default" untuk aksi netral (pink brand) */
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal konfirmasi generic pengganti `window.confirm()` — dipakai untuk
 * aksi yang butuh persetujuan eksplisit user (misal batalkan transaksi,
 * hapus data) supaya tampilannya konsisten dengan tema app, bukan dialog
 * native browser yang polos dan bisa berbeda-beda antar browser/device.
 *
 * Rendered lewat portal ke document.body agar tidak terpengaruh stacking
 * context/overflow dari komponen pemanggil.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Tutup dengan Escape (kecuali sedang loading, supaya tidak menutup di tengah proses)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, loading, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const isDanger = variant === "danger";

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !loading && onCancel()}
      />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-[scale-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ borderColor: isDanger ? "rgba(239,68,68,0.25)" : "rgba(255,61,127,0.25)" }}
      >
        <div
          className="h-1 w-full"
          style={{
            background: isDanger
              ? "linear-gradient(90deg, #EF4444, #F87171)"
              : "linear-gradient(90deg, #FF3D7F, #FF6B9D)",
          }}
        />
        <div className="p-6">
          <h2 id="confirm-dialog-title" className="text-lg font-bold text-[#FFF5F8]">
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-[#9B93B0]">{description}</p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: isDanger ? "#EF4444" : "#FF3D7F",
                boxShadow: isDanger
                  ? "0 4px 16px rgba(239,68,68,0.35)"
                  : "0 4px 16px rgba(255,61,127,0.35)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                  Memproses...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
