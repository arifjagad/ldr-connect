"use client";

interface GameSurrenderModalProps {
  /** Accent color for game theme */
  accentColor?: string;
  /** Whether the game has a winner/loser concept */
  hasWinner?: boolean;
  /** Custom warning text */
  warningText?: string;
  /** Loading state */
  loading?: boolean;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

export function GameSurrenderModal({
  hasWinner = true,
  warningText,
  loading = false,
  onConfirm,
  onCancel,
}: GameSurrenderModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs"
        onClick={() => !loading && onCancel()}
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-200">
          <span className="text-2xl">🏳️</span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Konfirmasi Menyerah</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-[#1F1D1B]">Yakin Ingin Menyerah?</h2>
        <div className="my-5 space-y-2 text-xs text-[#78716C]">
          <p className="flex items-start gap-2">
            <span className="mt-0.5 text-red-500 font-bold">•</span>
            Sesi game akan langsung diakhiri
          </p>
          {hasWinner && (
            <p className="flex items-start gap-2">
              <span className="mt-0.5 text-red-500 font-bold">•</span>
              <span>Partner akan dinyatakan sebagai pemenang</span>
            </p>
          )}
          {warningText && (
            <p className="flex items-start gap-2">
              <span className="mt-0.5 text-red-500 font-bold">•</span>
              {warningText}
            </p>
          )}
          <p className="flex items-start gap-2">
            <span className="mt-0.5 text-red-500 font-bold">•</span>
            Koin taruhan tidak dapat dikembalikan
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-[#E7E5E4] bg-white py-2.5 text-xs font-semibold text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
                Menyerah...
              </span>
            ) : "Ya, Menyerah"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple surrender button — use inside playing phase */
export function GameSurrenderButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={className ?? "w-full rounded-xl border border-red-200 bg-red-50/50 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100/50 cursor-pointer shadow-2xs"}
    >
      🏳️ Menyerah
    </button>
  );
}
