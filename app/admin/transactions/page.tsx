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
    paid: "bg-[#EBF9EB] text-[#10B981] border border-[#10B981]/20",
    pending: "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]",
    failed: "bg-red-50 text-red-600 border border-red-200",
  };

  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C84B31]">
          Keuangan
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1D1B] sm:text-3xl">
          Riwayat Transaksi
        </h1>
        <p className="mt-1 text-xs text-[#78716C]">{transactions.length} transaksi terbaru</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E7E5E4] bg-[#FCFBF7]">
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">User</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Reference</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Tipe</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Jumlah</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Status</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E5E4]">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-[#78716C]">
                  Belum ada transaksi
                </td>
              </tr>
            )}
            {transactions.map((tx) => {
              const u = tx.users as unknown as { name: string; email: string } | null;
              return (
                <tr key={tx.id} className="transition hover:bg-[#FCFBF7]">
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#1F1D1B]">{u?.name ?? "—"}</p>
                    <p className="text-[11px] text-[#78716C]">{u?.email ?? ""}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-[#78716C]">{tx.payment_reference ?? "—"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      tx.type === "topup"
                        ? "bg-[#EBF9EB] text-[#10B981] border border-[#10B981]/20"
                        : "bg-[#FDF4F2] text-[#C84B31] border border-[#FBDCD5]"
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-mono text-xs font-bold ${tx.type === "topup" ? "text-[#10B981]" : "text-[#C84B31]"}`}>
                      {tx.type === "topup" ? "+" : "-"}{tx.amount}
                    </span>
                    <span className="ml-1 text-[11px] text-[#78716C]">coin</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusStyle[tx.payment_status] ?? ""}`}>
                      {tx.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-[#78716C]">
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
