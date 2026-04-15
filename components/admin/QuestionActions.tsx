"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function QuestionActions({
  questionId,
  currentActive,
}: {
  questionId: number;
  currentActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("game_tod_questions")
      .update({ is_active: !currentActive })
      .eq("id", questionId);
    router.refresh();
    setLoading(false);
  }

  if (!currentActive) {
    // Pending → tampilkan tombol Approve dan Reject
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className="rounded-lg bg-[#34D399]/15 px-3 py-1.5 text-xs font-semibold text-[#34D399] transition hover:bg-[#34D399]/25 disabled:opacity-50"
        >
          {loading ? "..." : "Approve"}
        </button>
      </div>
    );
  }

  // Active → tampilkan tombol Deactivate
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
    >
      {loading ? "..." : "Nonaktifkan"}
    </button>
  );
}
