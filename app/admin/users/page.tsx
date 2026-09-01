import { createServiceClient } from "@/lib/supabase/server";

async function getUsers() {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, email, couple_code, status, is_admin, created_at, wallets(balance)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C84B31]">
          Manajemen
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1D1B] sm:text-3xl">
          Daftar Pengguna
        </h1>
        <p className="mt-1 text-xs text-[#78716C]">{users.length} user terdaftar</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E7E5E4] bg-[#FCFBF7]">
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">User</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Couple Code</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Status</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Saldo</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Role</th>
              <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Bergabung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E5E4]">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-[#78716C]">
                  Belum ada user
                </td>
              </tr>
            )}
            {users.map((u) => {
              const wallet = u.wallets as { balance: number } | { balance: number }[] | null;
              const balance = Array.isArray(wallet) ? (wallet[0]?.balance ?? 0) : (wallet?.balance ?? 0);
              return (
                <tr key={u.id} className="transition hover:bg-[#FCFBF7]">
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#1F1D1B]">{u.name}</p>
                    <p className="text-[11px] text-[#78716C]">{u.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs font-semibold text-[#1F1D1B]">{u.couple_code}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        u.status === "linked"
                          ? "bg-[#EBF9EB] text-[#10B981] border border-[#10B981]/20"
                          : "bg-[#F5F5F4] text-[#78716C] border border-[#E7E5E4]"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs font-bold text-[#1F1D1B]">{balance} coin</span>
                  </td>
                  <td className="px-5 py-4">
                    {u.is_admin ? (
                      <span className="inline-block rounded-full bg-[#FDF4F2] border border-[#FBDCD5] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#C84B31]">
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[#78716C]">User</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-[#78716C]">
                    {new Date(u.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
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
