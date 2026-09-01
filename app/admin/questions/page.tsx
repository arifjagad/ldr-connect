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
    <div className="px-6 py-8 sm:px-8">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C84B31]">
          Moderasi
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1D1B] sm:text-3xl">
          Pertanyaan ToD
        </h1>
        <p className="mt-1 text-xs text-[#78716C]">
          {pending.length} pending · {active.length} aktif
        </p>
      </div>

      {/* Pending approval */}
      {pending.length > 0 && (
        <div className="mb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#D97706]">
            Menunggu Persetujuan ({pending.length})
          </p>
          <div className="space-y-3">
            {pending.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7]/40 p-5 shadow-xl shadow-black/2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        q.type === "truth"
                          ? "bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]"
                          : "bg-[#FDF4F2] text-[#C84B31] border border-[#FBDCD5]"
                      }`}>
                        {q.type}
                      </span>
                      <span className="rounded-full bg-white border border-[#E7E5E4] px-2.5 py-0.5 text-[10px] font-semibold text-[#78716C]">
                        {q.category}
                      </span>
                      <span className="rounded-full bg-white border border-[#E7E5E4] px-2.5 py-0.5 text-[10px] font-semibold text-[#78716C]">
                        {q.source}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1F1D1B]">{q.question}</p>
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
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#10B981]">
          Pertanyaan Aktif ({active.length})
        </p>
        <div className="overflow-x-auto rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-[#FCFBF7]">
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Pertanyaan</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Tipe</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Kategori</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Source</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {active.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-[#78716C]">
                    Belum ada pertanyaan aktif
                  </td>
                </tr>
              )}
              {active.map((q) => (
                <tr key={q.id} className="transition hover:bg-[#FCFBF7]">
                  <td className="max-w-xs px-5 py-4 font-medium text-[#1F1D1B]">{q.question}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      q.type === "truth"
                        ? "bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]"
                        : "bg-[#FDF4F2] text-[#C84B31] border border-[#FBDCD5]"
                    }`}>
                      {q.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-[#78716C]">{q.category}</td>
                  <td className="px-5 py-4 text-xs font-semibold text-[#78716C]">{q.source}</td>
                  <td className="px-5 py-4">
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
