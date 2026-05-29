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
      <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#111113] px-4 py-3">
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">
            {myRole === "host" ? "Kamu" : "Partner"}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 w-1.5 rounded-sm transition-all duration-300"
                style={{
                  background: i < (myRole === "host" ? wallsLeft.host : wallsLeft.partner)
                    ? (myRole === "host" ? "#FF3D7F" : "#818CF8")
                    : "#1a1a1f",
                }}
              />
            ))}
          </div>
          <p className="mt-1 text-xs font-bold"
            style={{ color: myRole === "host" ? "#FF3D7F" : "#818CF8" }}>
            {myWalls} tembok
          </p>
        </div>

        <div className="text-[10px] text-[#3a3650]">VS</div>

        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">
            {myRole === "host" ? "Partner" : "Kamu"}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 w-1.5 rounded-sm transition-all duration-300"
                style={{
                  background: i < (myRole === "host" ? wallsLeft.partner : wallsLeft.host)
                    ? (myRole === "host" ? "#818CF8" : "#FF3D7F")
                    : "#1a1a1f",
                }}
              />
            ))}
          </div>
          <p className="mt-1 text-xs font-bold"
            style={{ color: myRole === "host" ? "#818CF8" : "#FF3D7F" }}>
            {oppWalls} tembok
          </p>
        </div>
      </div>

      {/* Mode toggle: Move vs Wall */}
      <div className="flex gap-2 rounded-xl border border-white/[0.07] bg-[#111113] p-1">
        <button
          onClick={() => onModeChange("move")}
          disabled={!isMyTurn}
          className={[
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200",
            mode === "move"
              ? "bg-[#FF3D7F] text-white shadow-[0_2px_12px_rgba(255,61,127,0.35)]"
              : "text-[#5C5470] hover:text-[#9B93B0] disabled:opacity-40",
          ].join(" ")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L12 22M2 12L22 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Gerak
        </button>

        <button
          onClick={() => onModeChange("wall")}
          disabled={!isMyTurn || myWalls <= 0}
          className={[
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200",
            mode === "wall"
              ? "bg-[#FBBF24] text-[#111] shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
              : "text-[#5C5470] hover:text-[#9B93B0] disabled:opacity-40",
          ].join(" ")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="4" rx="1" />
            <rect x="3" y="17" width="18" height="4" rx="1" />
          </svg>
          Tembok {myWalls <= 0 && "(habis)"}
        </button>
      </div>

      {/* Orientasi wall */}
      {mode === "wall" && (
        <div className="flex gap-2 rounded-xl border border-[#FBBF24]/20 bg-[#FBBF24]/5 p-1">
          <button
            onClick={() => onOrientChange("H")}
            className={[
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all duration-200",
              wallOrient === "H"
                ? "bg-[#FBBF24]/20 text-[#FBBF24]"
                : "text-[#5C5470] hover:text-[#9B93B0]",
            ].join(" ")}
          >
            <div className="h-0.5 w-5 rounded bg-current" />
            Horizontal
          </button>
          <button
            onClick={() => onOrientChange("V")}
            className={[
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all duration-200",
              wallOrient === "V"
                ? "bg-[#FBBF24]/20 text-[#FBBF24]"
                : "text-[#5C5470] hover:text-[#9B93B0]",
            ].join(" ")}
          >
            <div className="h-5 w-0.5 rounded bg-current" />
            Vertikal
          </button>
        </div>
      )}

      {/* Hint */}
      {isMyTurn && (
        <p className="text-center text-[10px] text-[#5C5470]">
          {mode === "move"
            ? "Klik sel yang bersinar untuk bergerak"
            : "Hover area antar sel untuk preview tembok"}
        </p>
      )}
    </div>
  );
}
