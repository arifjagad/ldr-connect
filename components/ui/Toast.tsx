"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
    </svg>
  ),
};

const STYLES: Record<ToastType, string> = {
  success: "border-[#10B981]/25 bg-white text-[#10B981] [--icon-bg:#EBF9EB]",
  error:   "border-red-200 bg-white text-red-600 [--icon-bg:#FEF2F2]",
  warning: "border-[#FDE68A] bg-white text-[#D97706] [--icon-bg:#FEF3C7]",
  info:    "border-[#E0E7FF] bg-white text-[#4F46E5] [--icon-bg:#EEF2FF]",
};

// ── Global toast state (singleton) ────────────────────────────────────────────
type Listener = (toasts: ToastMessage[]) => void;
let _toasts: ToastMessage[] = [];
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((l) => l([..._toasts]));
}

/** Call this anywhere to show a toast */
export function toast(message: Omit<ToastMessage, "id">) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  _toasts = [..._toasts, { ...message, id }];
  notify();
}

// Convenience shorthands
toast.success = (title: string, description?: string) =>
  toast({ type: "success", title, description, duration: 3500 });
toast.error = (title: string, description?: string) =>
  toast({ type: "error", title, description, duration: 5000 });
toast.warning = (title: string, description?: string) =>
  toast({ type: "warning", title, description, duration: 4000 });
toast.info = (title: string, description?: string) =>
  toast({ type: "info", title, description, duration: 3500 });

// ── Toast Container Component ──────────────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    _listeners.add(setToasts);
    return () => { _listeners.delete(setToasts); };
  }, []);

  const dismiss = useCallback((id: string) => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => {
      const duration = t.duration ?? 3500;
      return setTimeout(() => dismiss(t.id), duration);
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed top-5 right-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-[360px] flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 shadow-2xl shadow-black/10 backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-top-4 ${STYLES[t.type]}`}
        >
          {/* Icon */}
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-black/5" style={{ background: "var(--icon-bg)" }}>
            {ICONS[t.type]}
          </span>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1F1D1B]">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#78716C]">{t.description}</p>
            )}
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="mt-0.5 shrink-0 rounded-lg p-1 text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer"
            aria-label="Tutup"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
