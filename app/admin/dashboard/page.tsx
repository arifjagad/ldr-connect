import { createServiceClient } from "@/lib/supabase/server";

async function getStats() {
  const supabase = await createServiceClient();

  const [
    { count: totalUsers },
    { count: totalLinked },
    { count: pendingTx },
    { count: pendingQuestions },
    { data: recentTx },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "linked"),
    supabase.from("coin_transactions").select("*", { count: "exact", head: true }).eq("payment_status", "pending"),
    supabase.from("game_tod_questions").select("*", { count: "exact", head: true }).eq("is_active", false).eq("source", "user"),
    supabase
      .from("coin_transactions")
      .select("id, type, amount, payment_status, payment_reference, created_at, users(name, email)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    totalUsers: totalUsers ?? 0,
    totalLinked: totalLinked ?? 0,
    pendingTx: pendingTx ?? 0,
    pendingQuestions: pendingQuestions ?? 0,
    recentTx: recentTx ?? [],
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const cards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      color: "#4F46E5",
      bg: "#EEF2FF",
      border: "#E0E7FF",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Pasangan Terhubung",
      value: stats.totalLinked,
      color: "#10B981",
      bg: "#EBF9EB",
      border: "#10B98133",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      label: "Topup Pending",
      value: stats.pendingTx,
      color: "#D97706",
      bg: "#FEF3C7",
      border: "#FDE68A",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: "Pertanyaan Pending",
      value: stats.pendingQuestions,
      color: "#C84B31",
      bg: "#FDF4F2",
      border: "#FBDCD5",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C84B31]">
          Overview
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1D1B] sm:text-3xl">
          Dashboard Admin
        </h1>
        <p className="mt-1 text-xs text-[#78716C]">
          Overview statistik pengguna, pasangan, dan transaksi LDR-Connect.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-xl shadow-black/2"
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{ background: card.bg, borderColor: card.border, color: card.color }}
            >
              {card.icon}
            </div>
            <p className="font-serif text-3xl font-bold tabular-nums text-[#1F1D1B]">{card.value}</p>
            <p className="mt-1 text-xs font-semibold text-[#78716C]">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        <div className="border-b border-[#E7E5E4] bg-[#FCFBF7] px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">
            Transaksi Terbaru
          </p>
        </div>
        <div className="divide-y divide-[#E7E5E4] p-4 sm:p-6 space-y-2">
          {stats.recentTx.length === 0 && (
            <p className="py-8 text-center text-xs text-[#78716C]">Belum ada transaksi</p>
          )}
          {stats.recentTx.map((tx) => {
            const u = tx.users as unknown as { name: string; email: string } | null;
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-3 transition hover:border-[#D6D3D1]"
              >
                <div>
                  <p className="text-xs font-bold text-[#1F1D1B]">{u?.name ?? "—"}</p>
                  <p className="font-mono text-[10px] text-[#78716C]">{tx.payment_reference}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-mono font-bold ${tx.type === "topup" ? "text-[#10B981]" : "text-[#C84B31]"}`}>
                    {tx.type === "topup" ? "+" : "-"}{tx.amount} coin
                  </p>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      tx.payment_status === "paid"
                        ? "bg-[#EBF9EB] text-[#10B981] border border-[#10B981]/20"
                        : tx.payment_status === "pending"
                        ? "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {tx.payment_status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
