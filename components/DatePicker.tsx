"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS_ID = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYMD(s?: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function buildCalendar(year: number, month: number) {
  const firstDay   = new Date(year, month, 1).getDay();
  const totalDays  = daysInMonth(year, month);
  const prevTotal  = daysInMonth(
    month === 0 ? year - 1 : year,
    month === 0 ? 11 : month - 1,
  );

  const cells: { day: number; type: "prev" | "cur" | "next" }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevTotal - i, type: "prev" });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, type: "cur" });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, type: "next" });
  }

  return cells;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Props = {
  value: string;                  // "YYYY-MM-DD" or ""
  onChange: (val: string) => void;
  min?: string;                   // "YYYY-MM-DD" — earliest selectable date
  placeholder?: string;
  accentColor?: string;           // default "#C84B31"
};

// ── Component ─────────────────────────────────────────────────────────────────
export function DatePicker({
  value,
  onChange,
  min,
  placeholder = "Pilih tanggal...",
  accentColor = "#C84B31",
}: Props) {
  const today = new Date();

  const [open, setOpen]             = useState(false);
  const [mounted, setMounted]       = useState(false);
  const [rect, setRect]             = useState<{ top: number; left: number; width: number } | null>(null);
  const [viewYear, setViewYear]     = useState(today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(today.getMonth());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker]   = useState(false);

  const triggerRef  = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const yearBtnRef  = useRef<HTMLButtonElement>(null);

  const minDate     = parseYMD(min) ?? null;
  const selDate     = parseYMD(value);

  // Sync view month/year when value changes externally
  useEffect(() => {
    if (selDate && !open) {
      setViewYear(selDate.getFullYear());
      setViewMonth(selDate.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open]);

  // Scroll selected year into view when year picker opens
  useEffect(() => {
    if (showYearPicker && yearBtnRef.current) {
      yearBtnRef.current.scrollIntoView({ block: "center" });
    }
  }, [showYearPicker]);

  useEffect(() => { setMounted(true); }, []);

  // Calculate fixed position from trigger
  const calcRect = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const calH = 380;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < calH ? r.top - calH - 6 : r.bottom + 6;
    setRect({ top, left: r.left, width: Math.max(r.width, 280) });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || calendarRef.current?.contains(t)) return;
      setOpen(false);
      setShowMonthPicker(false);
      setShowYearPicker(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Recalc on scroll / resize
  useEffect(() => {
    if (!open) return;
    const fn = () => calcRect();
    window.addEventListener("scroll", fn, true);
    window.addEventListener("resize", fn);
    return () => {
      window.removeEventListener("scroll", fn, true);
      window.removeEventListener("resize", fn);
    };
  }, [open, calcRect]);

  function handleToggle() {
    setShowMonthPicker(false);
    setShowYearPicker(false);
    if (!open) calcRect();
    setOpen((o) => !o);
  }

  function prevMonth() {
    setShowMonthPicker(false); setShowYearPicker(false);
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    setShowMonthPicker(false); setShowYearPicker(false);
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number, type: "prev" | "cur" | "next") {
    let y = viewYear, m = viewMonth;
    if (type === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (type === "next") { m++; if (m > 11) { m = 0; y++; } }
    const cellDate = new Date(y, m, day);
    if (minDate && cellDate < minDate) return; // disabled
    onChange(toYMD(cellDate));
    setOpen(false);
  }

  function isCellSelected(day: number, type: "prev" | "cur" | "next") {
    if (!selDate) return false;
    let y = viewYear, m = viewMonth;
    if (type === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (type === "next") { m++; if (m > 11) { m = 0; y++; } }
    return selDate.getFullYear() === y && selDate.getMonth() === m && selDate.getDate() === day;
  }

  function isCellToday(day: number, type: "prev" | "cur" | "next") {
    let y = viewYear, m = viewMonth;
    if (type === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (type === "next") { m++; if (m > 11) { m = 0; y++; } }
    return today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
  }

  function isCellDisabled(day: number, type: "prev" | "cur" | "next") {
    if (!minDate) return false;
    let y = viewYear, m = viewMonth;
    if (type === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (type === "next") { m++; if (m > 11) { m = 0; y++; } }
    return new Date(y, m, day) < minDate;
  }

  const displayLabel = selDate
    ? `${selDate.getDate()} ${MONTHS_ID[selDate.getMonth()]} ${selDate.getFullYear()}`
    : null;

  const cells = buildCalendar(viewYear, viewMonth);
  const yearRange = Array.from({ length: 80 }, (_, i) => today.getFullYear() - 10 + i);

  return (
    <div className="relative">
      {/* ── Trigger ─────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-xs transition text-left ${
          open ? "border-[#C84B31] bg-white ring-1 ring-[#C84B31]/20" : "border-[#E7E5E4] bg-[#FCFBF7] hover:border-[#D6D3D1]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={displayLabel ? "#C84B31" : "#78716C"} strokeWidth="1.8"
        >
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>

        <span className={`flex-1 truncate ${displayLabel ? "text-[#1F1D1B] font-medium" : "text-[#A8A29E]"}`}>
          {displayLabel ?? placeholder}
        </span>

        {/* Clear */}
        {displayLabel && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="shrink-0 rounded-full p-0.5 text-[#78716C] transition hover:text-[#1F1D1B] cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </span>
        )}

        {/* Chevron */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#78716C" strokeWidth="2.5"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Calendar Portal ──────────────────────────────────────── */}
      {mounted && open && rect && createPortal(
        <div
          ref={calendarRef}
          style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, minWidth: 280, zIndex: 9999 }}
          className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-xl shadow-black/[0.06]"
        >
          {/* Header: nav + month/year picker */}
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F1D1B]">
              {/* Month picker */}
              <div className="relative">
                <button type="button"
                  onClick={() => { setShowMonthPicker((v) => !v); setShowYearPicker(false); }}
                  className="flex items-center gap-1 rounded px-1.5 py-1 transition hover:bg-[#FDF4F2] hover:text-[#C84B31]"
                >
                  {MONTHS_ID[viewMonth]}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#78716C]">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showMonthPicker && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-32 max-h-48 overflow-y-auto rounded-xl border border-[#E7E5E4] bg-white p-1.5 shadow-xl z-50 [scrollbar-width:none]">
                    {MONTHS_ID.map((m, i) => (
                      <button key={m} type="button"
                        onClick={() => { setViewMonth(i); setShowMonthPicker(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition ${
                          viewMonth === i ? "bg-[#FDF4F2] font-bold text-[#C84B31]" : "text-[#1F1D1B] hover:bg-[#FCFBF7]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Year picker */}
              <div className="relative">
                <button type="button"
                  onClick={() => { setShowYearPicker((v) => !v); setShowMonthPicker(false); }}
                  className="flex items-center gap-1 rounded px-1.5 py-1 transition hover:bg-[#FDF4F2] hover:text-[#C84B31]"
                >
                  {viewYear}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#78716C]">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showYearPicker && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-24 max-h-48 overflow-y-auto rounded-xl border border-[#E7E5E4] bg-white p-1.5 shadow-xl z-50 [scrollbar-width:none]">
                    {yearRange.map((y) => {
                      const isSel = viewYear === y;
                      return (
                        <button key={y} type="button"
                          ref={isSel ? yearBtnRef : null}
                          onClick={() => { setViewYear(y); setShowYearPicker(false); }}
                          className={`w-full text-center px-2 py-1.5 text-xs rounded-lg transition ${
                            isSel ? "bg-[#FDF4F2] font-bold text-[#C84B31]" : "text-[#1F1D1B] hover:bg-[#FCFBF7]"
                          }`}
                        >
                          {y}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button type="button" onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Day headers — Indonesian */}
          <div className="mb-2 grid grid-cols-7">
            {DAYS_ID.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#78716C]">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, i) => {
              const selected  = isCellSelected(cell.day, cell.type);
              const isToday   = isCellToday(cell.day, cell.type);
              const disabled  = isCellDisabled(cell.day, cell.type);
              const muted     = cell.type !== "cur";

              return (
                <button key={i} type="button"
                  disabled={disabled}
                  onClick={() => selectDay(cell.day, cell.type)}
                  className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all
                    ${disabled
                      ? "cursor-not-allowed text-[#D6D3D1]"
                      : selected
                        ? "bg-[#C84B31] text-white font-bold shadow-xs"
                        : isToday
                          ? "bg-[#FDF4F2] text-[#C84B31] font-bold"
                          : muted
                            ? "text-[#A8A29E] hover:bg-[#FCFBF7]"
                            : "text-[#1F1D1B] hover:bg-[#FCFBF7]"
                    }`}
                >
                  {cell.day}
                  {isToday && !selected && (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#C84B31]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 flex justify-between border-t border-[#E7E5E4] pt-3">
            <button type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs font-medium text-[#78716C] transition hover:text-[#1F1D1B]"
            >
              Hapus
            </button>
            <button type="button"
              onClick={() => {
                const d = new Date();
                if (minDate && d < minDate) return;
                onChange(toYMD(d));
                setOpen(false);
              }}
              className="text-xs font-semibold text-[#C84B31] hover:underline"
            >
              Hari ini
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
