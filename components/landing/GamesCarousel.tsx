"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";

export interface GameItem {
  id: string;
  title: string;
  desc: string;
  price: string;
  href: string;
  iconType: "tod" | "snake_ladder" | "dare_derby" | "quoridor" | "default";
}

function GameIcon({ type }: { type: GameItem["iconType"] }) {
  switch (type) {
    case "tod":
      return (
        <svg className="h-6 w-6 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v7.018z"
          />
        </svg>
      );
    case "snake_ladder":
      return (
        <svg className="h-6 w-6 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case "dare_derby":
      return (
        <svg className="h-6 w-6 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.496m5.007 0a7.454 7.454 0 01-.982-3.172M9.496 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
          />
        </svg>
      );
    case "quoridor":
      return (
        <svg className="h-6 w-6 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      );
    default:
      return (
        <svg className="h-6 w-6 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
  }
}

export function GamesCarousel({ games }: { games: GameItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [games]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    const scrollAmount = direction === "left" ? -clientWidth * 0.75 : clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <div className="relative mt-12 w-full">
      {/* Carousel Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="no-scrollbar flex gap-6 overflow-x-auto scroll-smooth pb-4 pt-1 snap-x snap-mandatory"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {games.map((game) => (
          <div
            key={game.id}
            className="flex min-w-[280px] sm:min-w-[320px] md:min-w-[350px] max-w-[380px] flex-1 shrink-0 snap-start flex-col justify-between rounded-2xl border border-[#E7E5E4] bg-white p-7 text-left shadow-xs transition-all duration-200 hover:border-[#D6D3D1] hover:shadow-md"
          >
            <div>
              {/* Minimalist Outlined Icon Frame */}
              <div className="flex h-20 w-full items-center justify-center rounded-xl bg-[#FCFBF7] border border-[#F5F5F4]">
                <GameIcon type={game.iconType} />
              </div>

              <h3 className="mt-6 text-base font-bold text-[#1F1D1B]">{game.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#78716C] line-clamp-3">{game.desc}</p>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-[#F5F5F4] pt-4 text-xs">
              <span className="text-[11px] font-medium text-[#78716C]">{game.price}</span>
              <Link href={game.href} className="font-semibold text-[#1F1D1B] transition-colors hover:text-[#C84B31]">
                Mulai Main →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Controls & Indicator */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          aria-label="Previous game"
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-[#E7E5E4] bg-white text-[#1F1D1B] shadow-xs transition-all ${
            !canScrollLeft
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-[#FCFBF7] hover:border-[#D6D3D1] active:scale-95"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span className="text-[11px] font-medium text-[#78716C]">
          Geser untuk melihat semua game
        </span>

        <button
          type="button"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          aria-label="Next game"
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-[#E7E5E4] bg-white text-[#1F1D1B] shadow-xs transition-all ${
            !canScrollRight
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-[#FCFBF7] hover:border-[#D6D3D1] active:scale-95"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
