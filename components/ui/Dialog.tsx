"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export type DialogVariant = "danger" | "warning" | "info" | "success" | "question";

export interface DialogOptions {
  title: string;
  description?: string;
  badge?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  isDanger?: boolean;
  showCancel?: boolean;
}

interface DialogState extends DialogOptions {
  id: string;
  resolve: (value: boolean) => void;
}

let _currentDialog: DialogState | null = null;
const _listeners = new Set<(d: DialogState | null) => void>();

function notify() {
  _listeners.forEach((l) => l(_currentDialog));
}

export const dialog = {
  confirm: (options: DialogOptions | string): Promise<boolean> => {
    const opts: DialogOptions =
      typeof options === "string" ? { title: options } : options;

    return new Promise<boolean>((resolve) => {
      _currentDialog = {
        id: `dialog-${Date.now()}`,
        title: opts.title,
        description: opts.description,
        badge: opts.badge ?? (opts.isDanger || opts.variant === "danger" ? "Peringatan" : "Konfirmasi"),
        confirmText: opts.confirmText ?? "Ya, Lanjutkan",
        cancelText: opts.cancelText ?? "Batal",
        variant: opts.variant ?? (opts.isDanger ? "danger" : "question"),
        isDanger: opts.isDanger ?? opts.variant === "danger",
        showCancel: opts.showCancel ?? true,
        resolve,
      };
      notify();
    });
  },
  alert: (options: DialogOptions | string): Promise<boolean> => {
    const opts: DialogOptions =
      typeof options === "string" ? { title: options } : options;

    return dialog.confirm({
      ...opts,
      showCancel: false,
      confirmText: opts.confirmText ?? "Mengerti",
    });
  },
};

const VARIANT_CONFIG: Record<
  DialogVariant,
  {
    iconBg: string;
    iconBorder: string;
    iconColor: string;
    badgeBg: string;
    badgeBorder: string;
    badgeColor: string;
    btnClass: string;
    icon: React.ReactNode;
  }
> = {
  danger: {
    iconBg: "bg-[#FEF2F2]",
    iconBorder: "border-red-200",
    iconColor: "text-red-600",
    badgeBg: "bg-[#FEF2F2]",
    badgeBorder: "border-red-200",
    badgeColor: "text-red-600",
    btnClass: "bg-[#EF4444] text-white hover:bg-[#DC2626] shadow-xs",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  warning: {
    iconBg: "bg-[#FEF3C7]",
    iconBorder: "border-[#FDE68A]",
    iconColor: "text-[#D97706]",
    badgeBg: "bg-[#FEF3C7]",
    badgeBorder: "border-[#FDE68A]",
    badgeColor: "text-[#D97706]",
    btnClass: "bg-[#D97706] text-white hover:bg-[#B45309] shadow-xs",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  question: {
    iconBg: "bg-[#FDF4F2]",
    iconBorder: "border-[#FBDCD5]",
    iconColor: "text-[#C84B31]",
    badgeBg: "bg-[#FDF4F2]",
    badgeBorder: "border-[#FBDCD5]",
    badgeColor: "text-[#C84B31]",
    btnClass: "bg-[#C84B31] text-white hover:bg-[#B33E26] shadow-xs",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    iconBg: "bg-[#EEF2FF]",
    iconBorder: "border-[#E0E7FF]",
    iconColor: "text-[#4F46E5]",
    badgeBg: "bg-[#EEF2FF]",
    badgeBorder: "border-[#E0E7FF]",
    badgeColor: "text-[#4F46E5]",
    btnClass: "bg-[#4F46E5] text-white hover:bg-[#4338CA] shadow-xs",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  success: {
    iconBg: "bg-[#EBF9EB]",
    iconBorder: "border-[#10B981]/25",
    iconColor: "text-[#10B981]",
    badgeBg: "bg-[#EBF9EB]",
    badgeBorder: "border-[#10B981]/25",
    badgeColor: "text-[#10B981]",
    btnClass: "bg-[#10B981] text-white hover:bg-[#059669] shadow-xs",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
};

export function DialogContainer() {
  const [current, setCurrent] = useState<DialogState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    _listeners.add(setCurrent);
    return () => {
      _listeners.delete(setCurrent);
    };
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (_currentDialog) {
      const res = _currentDialog.resolve;
      _currentDialog = null;
      notify();
      res(result);
    }
  }, []);

  useEffect(() => {
    if (!current) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, handleClose]);

  if (!mounted || !current) return null;

  const variant = current.variant ?? (current.isDanger ? "danger" : "question");
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.question;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1F1D1B]/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => handleClose(false)}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-2xl shadow-black/10 transition-all animate-in zoom-in-95 duration-200 text-center">
        {/* Top Icon Badge */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-xs transition-transform hover:scale-105"
          style={{
            backgroundColor: variant === "danger" ? "#FEF2F2" : variant === "warning" ? "#FEF3C7" : variant === "info" ? "#EEF2FF" : variant === "success" ? "#EBF9EB" : "#FDF4F2",
            borderColor: variant === "danger" ? "#FECACA" : variant === "warning" ? "#FDE68A" : variant === "info" ? "#E0E7FF" : variant === "success" ? "rgba(16,185,129,0.25)" : "#FBDCD5",
            color: variant === "danger" ? "#EF4444" : variant === "warning" ? "#D97706" : variant === "info" ? "#4F46E5" : variant === "success" ? "#10B981" : "#C84B31",
          }}
        >
          {cfg.icon}
        </div>

        {/* Badge Label */}
        {current.badge && (
          <div className="mb-2">
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeColor}`}
            >
              {current.badge}
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#1F1D1B]">
          {current.title}
        </h3>

        {/* Description */}
        {current.description && (
          <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#78716C]">
            {current.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
          {current.showCancel && (
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="w-full sm:w-auto rounded-full border border-[#E7E5E4] bg-white px-6 py-2.5 text-xs sm:text-sm font-semibold text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer focus:outline-none"
            >
              {current.cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleClose(true)}
            autoFocus
            className={`w-full sm:w-auto rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${cfg.btnClass}`}
          >
            {current.confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default dialog;
