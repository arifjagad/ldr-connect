"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";

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
    if (currentActive) {
      const confirmed = await dialog.confirm({
        title: "Nonaktifkan Pertanyaan?",
        description: "Pertanyaan ini tidak akan lagi muncul dalam permainan Truth or Dare.",
        confirmText: "Ya, Nonaktifkan",
        cancelText: "Batal",
        isDanger: true,
      });
      if (!confirmed) return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("game_tod_questions")
      .update({ is_active: !currentActive })
      .eq("id", questionId);

    if (error) {
      toast.error("Gagal Memperbarui", error.message);
    } else {
      toast.success(
        currentActive ? "Pertanyaan Dinonaktifkan" : "Pertanyaan Disetujui",
        currentActive ? "Pertanyaan berhasil dinonaktifkan." : "Pertanyaan kini aktif dan bisa dimainkan."
      );
      router.refresh();
    }
    setLoading(false);
  }

  if (!currentActive) {
    // Pending → tampilkan tombol Approve
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className="rounded-xl border border-[#10B981]/20 bg-[#EBF9EB] px-3.5 py-1.5 text-xs font-bold text-[#10B981] transition hover:bg-[#10B981]/15 disabled:opacity-50 cursor-pointer"
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
      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50 cursor-pointer"
    >
      {loading ? "..." : "Nonaktifkan"}
    </button>
  );
}
