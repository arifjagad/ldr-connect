import { createServiceClient } from "@/lib/supabase/server";

async function getTransactions() {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("coin_transactions")
    .select(`
      id,
      type,
      amount,
      payment_status,
      payment_reference,
      paid_at,
      created_at,
      users (name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export default async function AdminTransactionsPage() {
  const transactions = await getTransactions();

  const statusStyle: Record<string, string> = {
    paid: "bg-[#34D399]/10 text-[#34D399]",
    pending: "bg-yellow-500/10 text-yellow-400",
    failed: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#FFF5F8]">Transaksi</h1>
        <p className="mt-1 text-sm text-[#5C5470]">{transactions.length} transaksi terbaru</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">User</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Reference</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Tipe</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Jumlah</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#5C5470]">
                  Belum ada transaksi
                </td>
              </tr>
            )}
            {transactions.map((tx) => {
              const u = tx.users as unknown as { name: string; email: string } | null;
              return (
                <tr key={tx.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#FFF5F8]">{u?.name ?? "—"}</p>
                    <p className="text-xs text-[#5C5470]">{u?.email ?? ""}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[11px] text-[#5C5470]">{tx.payment_reference ?? "—"}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold ${tx.type === "topup" ? "text-[#34D399]" : "text-[#FF6B9D]"}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`font-mono font-bold ${tx.type === "topup" ? "text-[#34D399]" : "text-[#FF6B9D]"}`}>
                      {tx.type === "topup" ? "+" : "-"}{tx.amount}
                    </span>
                    <span className="ml-1 text-xs text-[#5C5470]">coin</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${statusStyle[tx.payment_status] ?? ""}`}>
                      {tx.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#5C5470]">
                    {new Date(tx.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
