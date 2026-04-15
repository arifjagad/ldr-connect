"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder = "Pilih...", className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Tutup saat tekan Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all duration-150 ${
          open
            ? "border-[#818CF8]/50 bg-[#18181C] ring-1 ring-[#818CF8]/20"
            : "border-white/10 bg-[#18181C] hover:border-white/20"
        }`}
      >
        <span className={selected ? "text-[#FFF5F8]" : "text-[#5C5470]"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-[#5C5470] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#1C1C22] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          style={{ animation: "selectDropdown 0.15s ease" }}
        >
          <ul className="py-1 max-h-56 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-[#818CF8]/15 text-[#818CF8]"
                        : "text-[#9B93B0] hover:bg-white/[0.05] hover:text-[#FFF5F8]"
                    }`}
                  >
                    <div className="text-left">
                      <span className="block font-medium">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[10px] text-[#5C5470] mt-0.5">{opt.description}</span>
                      )}
                    </div>
                    {isSelected && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <style>{`
        @keyframes selectDropdown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
