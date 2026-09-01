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
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
          open
            ? "border-[#C84B31] bg-white ring-2 ring-[#C84B31]/10"
            : "border-[#E7E5E4] bg-[#FCFBF7] hover:border-[#D6D3D1] hover:bg-white"
        }`}
      >
        <span className={selected ? "text-[#1F1D1B] font-bold" : "text-[#78716C]"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#78716C"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-[#C84B31]" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/10">
          <ul className="py-1 max-h-56 overflow-y-auto divide-y divide-[#F5F5F4]">
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
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? "bg-[#FDF4F2] text-[#C84B31]"
                        : "text-[#1F1D1B] hover:bg-[#FCFBF7]"
                    }`}
                  >
                    <div className="text-left">
                      <span className="block font-medium">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[10px] text-[#78716C] mt-0.5">{opt.description}</span>
                      )}
                    </div>
                    {isSelected && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="2.5">
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
    </div>
  );
}
