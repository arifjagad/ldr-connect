import { createServiceClient } from "@/lib/supabase/server";
import { QuestionActions } from "@/components/admin/QuestionActions";

async function getQuestions() {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("game_tod_questions")
    .select("id, type, question, category, source, is_active, created_at")
    .order("is_active", { ascending: true })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function AdminQuestionsPage() {
  const questions = await getQuestions();
  const pending = questions.filter((q) => !q.is_active);
  const active = questions.filter((q) => q.is_active);

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#FFF5F8]">Pertanyaan ToD</h1>
        <p className="mt-1 text-sm text-[#5C5470]">
          {pending.length} pending · {active.length} aktif
        </p>
      </div>

      {/* Pending approval */}
      {pending.length > 0 && (
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Menunggu Persetujuan ({pending.length})
          </p>
          <div className="space-y-3">
            {pending.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-yellow-500/15 bg-[#111113] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${q.type === "truth" ? "bg-[#818CF8]/10 text-[#818CF8]" : "bg-[#FF3D7F]/10 text-[#FF6B9D]"}`}>
                        {q.type}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] text-[#5C5470]">
                        {q.category}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] text-[#5C5470]">
                        {q.source}
                      </span>
                    </div>
                    <p className="text-sm text-[#FFF5F8]">{q.question}</p>
                  </div>
                  <QuestionActions questionId={q.id} currentActive={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active questions */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#34D399]">
          Pertanyaan Aktif ({active.length})
        </p>
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Pertanyaan</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Tipe</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Kategori</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Source</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {active.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#5C5470]">
                    Belum ada pertanyaan aktif
                  </td>
                </tr>
              )}
              {active.map((q) => (
                <tr key={q.id} className="hover:bg-white/[0.02]">
                  <td className="max-w-xs px-5 py-3.5 text-[#9B93B0]">{q.question}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${q.type === "truth" ? "bg-[#818CF8]/10 text-[#818CF8]" : "bg-[#FF3D7F]/10 text-[#FF6B9D]"}`}>
                      {q.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#5C5470]">{q.category}</td>
                  <td className="px-5 py-3.5 text-xs text-[#5C5470]">{q.source}</td>
                  <td className="px-5 py-3.5">
                    <QuestionActions questionId={q.id} currentActive={true} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
