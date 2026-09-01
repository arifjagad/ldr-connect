"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
};

type DropdownRect = {
  top: number;
  left: number;
  width: number;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.trim().toLowerCase())
      )
    : options;

  // Hitung posisi dropdown berdasarkan trigger button (portal + fixed)
  const calcRect = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownRect({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Mount check agar createPortal tidak error di SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Tutup dan recalc posisi saat scroll/resize
  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => {
      calcRect();
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, calcRect]);

  // Fokus ke search input saat buka
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  function handleToggle() {
    if (!open) {
      calcRect();
    }
    setOpen((o) => !o);
    setSearch("");
  }

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
          open
            ? "border-[#C84B31] bg-white ring-2 ring-[#C84B31]/10"
            : "border-[#E7E5E4] bg-[#FCFBF7] hover:border-[#D6D3D1] hover:bg-white"
        } text-left`}
      >
        {/* Search icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={selected ? "#C84B31" : "#78716C"}
          strokeWidth="2"
          className="shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>

        <span className={`flex-1 truncate ${selected ? "text-[#1F1D1B] font-bold" : "text-[#78716C]"}`}>
          {selected ? selected.label : placeholder}
        </span>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#78716C"
          strokeWidth="2.5"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-[#C84B31]" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown — di-render via Portal ke document.body dengan position: fixed */}
      {mounted && open && dropdownRect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
            }}
            className="rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/10 overflow-hidden"
          >
            {/* Search input */}
            <div className="border-b border-[#E7E5E4] bg-[#FCFBF7] p-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-3 py-2">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#78716C"
                  strokeWidth="2"
                  className="shrink-0"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-[#78716C] transition hover:text-[#1F1D1B] cursor-pointer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Options list */}
            <ul className="max-h-52 overflow-y-auto overscroll-contain py-1 divide-y divide-[#F5F5F4]">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-center text-xs text-[#78716C]">
                  Tidak ada hasil
                </li>
              ) : (
                filtered.map((opt) => {
                  const isActive = opt.value === value;
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                          isActive
                            ? "bg-[#FDF4F2] text-[#C84B31]"
                            : "text-[#1F1D1B] hover:bg-[#FCFBF7]"
                        }`}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {isActive && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        {opt.label}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
