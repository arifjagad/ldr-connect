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
      color: "#818CF8",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Pasangan Terhubung",
      value: stats.totalLinked,
      color: "#34D399",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      label: "Topup Pending",
      value: stats.pendingTx,
      color: "#F59E0B",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: "Pertanyaan Pending",
      value: stats.pendingQuestions,
      color: "#FF6B9D",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#FFF5F8]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#5C5470]">Overview statistik LDR-Connect</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/[0.07] bg-[#111113] p-5"
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: `${card.color}18`, color: card.color }}
            >
              {card.icon}
            </div>
            <p className="text-3xl font-bold tabular-nums text-[#FFF5F8]">{card.value}</p>
            <p className="mt-1 text-xs text-[#5C5470]">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="mt-8 rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
        <p className="mb-4 text-sm font-semibold text-[#FFF5F8]">Transaksi Terbaru</p>
        <div className="space-y-2">
          {stats.recentTx.length === 0 && (
            <p className="py-6 text-center text-sm text-[#5C5470]">Belum ada transaksi</p>
          )}
          {stats.recentTx.map((tx) => {
            const u = tx.users as unknown as { name: string; email: string } | null;
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-[#18181C] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[#FFF5F8]">{u?.name ?? "—"}</p>
                  <p className="font-mono text-[10px] text-[#5C5470]">{tx.payment_reference}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.type === "topup" ? "text-[#34D399]" : "text-[#FF6B9D]"}`}>
                    {tx.type === "topup" ? "+" : "-"}{tx.amount} coin
                  </p>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      tx.payment_status === "paid"
                        ? "text-[#34D399]"
                        : tx.payment_status === "pending"
                        ? "text-yellow-400"
                        : "text-red-400"
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
