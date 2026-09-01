"use client";

interface WallModeToggleProps {
  mode:          "move" | "wall";
  wallOrient:    "H" | "V";
  wallsLeft:     { host: number; partner: number };
  myRole:        "host" | "partner";
  isMyTurn:      boolean;
  onModeChange:  (mode: "move" | "wall") => void;
  onOrientChange:(orient: "H" | "V") => void;
}

export function WallModeToggle({
  mode,
  wallOrient,
  wallsLeft,
  myRole,
  isMyTurn,
  onModeChange,
  onOrientChange,
}: WallModeToggleProps) {
  const myWalls = myRole === "host" ? wallsLeft.host : wallsLeft.partner;
  const oppWalls = myRole === "host" ? wallsLeft.partner : wallsLeft.host;

  return (
    <div className="space-y-3">
      {/* Sisa tembok info */}
      <div className="flex items-center justify-between rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-xl shadow-black/2">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
            {myRole === "host" ? "Kamu (Host)" : "Kamu (Partner)"}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 w-1.5 rounded-xs transition-all duration-300"
                style={{
                  background: i < (myRole === "host" ? wallsLeft.host : wallsLeft.partner)
                    ? (myRole === "host" ? "#C84B31" : "#4F46E5")
                    : "#E7E5E4",
                }}
              />
            ))}
          </div>
          <p
            className="mt-1 text-xs font-bold"
            style={{ color: myRole === "host" ? "#C84B31" : "#4F46E5" }}
          >
            {myWalls} tembok
          </p>
        </div>

        <div className="text-xs font-bold text-[#A8A29E]">VS</div>

        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
            {myRole === "host" ? "Partner" : "Host"}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 w-1.5 rounded-xs transition-all duration-300"
                style={{
                  background: i < (myRole === "host" ? wallsLeft.partner : wallsLeft.host)
                    ? (myRole === "host" ? "#4F46E5" : "#C84B31")
                    : "#E7E5E4",
                }}
              />
            ))}
          </div>
          <p
            className="mt-1 text-xs font-bold"
            style={{ color: myRole === "host" ? "#4F46E5" : "#C84B31" }}
          >
            {oppWalls} tembok
          </p>
        </div>
      </div>

      {/* Mode toggle: Move vs Wall */}
      <div className="flex gap-2 rounded-2xl border border-[#E7E5E4] bg-[#FCFBF7] p-1.5">
        <button
          onClick={() => onModeChange("move")}
          disabled={!isMyTurn}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition cursor-pointer ${
            mode === "move"
              ? "bg-[#C84B31] text-white shadow-xs"
              : "text-[#78716C] hover:text-[#1F1D1B] disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L12 22M2 12L22 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Gerak
        </button>

        <button
          onClick={() => onModeChange("wall")}
          disabled={!isMyTurn || myWalls <= 0}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition cursor-pointer ${
            mode === "wall"
              ? "bg-[#D97706] text-white shadow-xs"
              : "text-[#78716C] hover:text-[#1F1D1B] disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="4" rx="1" />
            <rect x="3" y="17" width="18" height="4" rx="1" />
          </svg>
          Tembok {myWalls <= 0 && "(habis)"}
        </button>
      </div>

      {/* Wall orientation */}
      {mode === "wall" && (
        <div className="flex gap-2 rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-1.5">
          <button
            onClick={() => onOrientChange("H")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              wallOrient === "H"
                ? "bg-white text-[#D97706] shadow-2xs"
                : "text-[#92400E] hover:text-[#78350F]"
            }`}
          >
            <div className="h-1 w-5 rounded bg-current" />
            Horizontal
          </button>
          <button
            onClick={() => onOrientChange("V")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              wallOrient === "V"
                ? "bg-white text-[#D97706] shadow-2xs"
                : "text-[#92400E] hover:text-[#78350F]"
            }`}
          >
            <div className="h-5 w-1 rounded bg-current" />
            Vertikal
          </button>
        </div>
      )}

      {/* Hint */}
      {isMyTurn && (
        <p className="text-center text-[11px] text-[#78716C]">
          {mode === "move"
            ? "Klik sel yang ditandai untuk melangkah"
            : "Hover area antar sel untuk menentukan posisi tembok"}
        </p>
      )}
    </div>
  );
}
