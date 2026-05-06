"use client";

import { useEffect, useRef, useState } from "react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { day: number; month: "prev" | "cur" | "next" }[] = [];

  // leading days from prev month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, month: "prev" });
  }

  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: "cur" });
  }

  // trailing days to complete last row
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: "next" });
  }

  return cells;
}

type Props = {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (val: string) => void;
  placeholder?: string;
};

export function DatePicker({ value, onChange, placeholder = "Pick a date" }: Props) {
  const today = new Date();
  const initYear = value ? Number(value.split("-")[0]) : today.getFullYear();
  const initMonth = value ? Number(value.split("-")[1]) - 1 : today.getMonth();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [showMonthSelect, setShowMonthSelect] = useState(false);
  const [showYearSelect, setShowYearSelect] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showYearSelect && yearRef.current) {
      yearRef.current.scrollIntoView({ block: "center" });
    }
  }, [showYearSelect]);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number, which: "prev" | "cur" | "next") {
    let y = viewYear;
    let m = viewMonth;
    if (which === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (which === "next") { m++; if (m > 11) { m = 0; y++; } }
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${y}-${mm}-${dd}`);
    setOpen(false);
  }

  // parse selected value
  const selParts = value ? value.split("-") : null;
  const selYear = selParts ? Number(selParts[0]) : null;
  const selMonth = selParts ? Number(selParts[1]) - 1 : null;
  const selDay = selParts ? Number(selParts[2]) : null;

  function isSelected(day: number, which: "prev" | "cur" | "next") {
    if (selYear === null || selMonth === null || selDay === null) return false;
    let y = viewYear, m = viewMonth;
    if (which === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (which === "next") { m++; if (m > 11) { m = 0; y++; } }
    return selYear === y && selMonth === m && selDay === day;
  }

  function isToday(day: number, which: "prev" | "cur" | "next") {
    let y = viewYear, m = viewMonth;
    if (which === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (which === "next") { m++; if (m > 11) { m = 0; y++; } }
    return today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
  }

  // display label
  const displayLabel = selParts
    ? `${selDay} ${MONTHS[selMonth!]} ${selYear}`
    : null;

  const cells = buildCalendar(viewYear, viewMonth);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
          open
            ? "border-[#F472B6]/40 ring-1 ring-[#F472B6]/20"
            : "border-white/10 hover:border-white/20"
        } bg-[#18181C] text-left`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke={displayLabel ? "#F472B6" : "#5C5470"}
          strokeWidth="1.8"
        >
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
        <span className={displayLabel ? "text-[#FFF5F8]" : "text-[#5C5470]"}>
          {displayLabel ?? placeholder}
        </span>
        {displayLabel && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="ml-auto text-[#5C5470] transition hover:text-[#9B93B0]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-2xl shadow-black/60">
          {/* Month navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9B93B0] transition hover:bg-white/10 hover:text-[#FFF5F8]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#FFF5F8]">
              {/* Month Select */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowMonthSelect(!showMonthSelect); setShowYearSelect(false); }}
                  className="flex items-center gap-1 rounded hover:text-[#F472B6] transition"
                >
                  {MONTHS[viewMonth]}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#5C5470]">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                
                {showMonthSelect && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-32 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#18181C] p-1.5 shadow-2xl z-50 [scrollbar-width:none]">
                    {MONTHS.map((m, i) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setViewMonth(i); setShowMonthSelect(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                          viewMonth === i ? "bg-[#F472B6]/20 text-[#F472B6] font-bold" : "text-[#FFF5F8] hover:bg-white/10"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Year Select */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowYearSelect(!showYearSelect); setShowMonthSelect(false); }}
                  className="flex items-center gap-1 rounded hover:text-[#F472B6] transition"
                >
                  {viewYear}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#5C5470]">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                
                {showYearSelect && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-24 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#18181C] p-1.5 shadow-2xl z-50 [scrollbar-width:none]">
                    {Array.from({ length: 100 }).map((_, i) => {
                      const y = today.getFullYear() - 60 + i;
                      const isSelected = viewYear === y;
                      return (
                        <button
                          key={y}
                          type="button"
                          ref={isSelected ? yearRef : null}
                          onClick={() => { setViewYear(y); setShowYearSelect(false); }}
                          className={`w-full text-center px-2 py-2 text-xs rounded-lg transition ${
                            isSelected ? "bg-[#F472B6]/20 text-[#F472B6] font-bold" : "text-[#FFF5F8] hover:bg-white/10"
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

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9B93B0] transition hover:bg-white/10 hover:text-[#FFF5F8]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-2 grid grid-cols-7">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#5C5470]">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, i) => {
              const selected = isSelected(cell.day, cell.month);
              const todayCell = isToday(cell.day, cell.month);
              const muted = cell.month !== "cur";

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(cell.day, cell.month)}
                  className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all
                    ${selected
                      ? "bg-[#F472B6] text-white shadow-[0_2px_10px_rgba(244,114,182,0.45)]"
                      : todayCell
                        ? "bg-white/10 text-[#FFF5F8] font-bold"
                        : muted
                          ? "text-[#5C5470] hover:bg-white/5 hover:text-[#9B93B0]"
                          : "text-[#FFF5F8] hover:bg-white/10"
                    }
                  `}
                >
                  {cell.day}
                  {todayCell && !selected && (
                    <span className="absolute bottom-1 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-[#F472B6]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="mt-3 flex justify-between border-t border-white/[0.07] pt-3">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs font-medium text-[#5C5470] transition hover:text-[#9B93B0]"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={() => {
                const y = today.getFullYear();
                const m = String(today.getMonth() + 1).padStart(2, "0");
                const d = String(today.getDate()).padStart(2, "0");
                onChange(`${y}-${m}-${d}`);
                setOpen(false);
              }}
              className="text-xs font-medium text-[#F472B6] transition hover:text-[#E879F9]"
            >
              Hari ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
