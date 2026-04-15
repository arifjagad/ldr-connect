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
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#FFF5F8]">Users</h1>
        <p className="mt-1 text-sm text-[#5C5470]">{users.length} user terdaftar</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">User</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Couple Code</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Saldo</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Role</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Bergabung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#5C5470]">
                  Belum ada user
                </td>
              </tr>
            )}
            {users.map((u) => {
              const wallet = u.wallets as { balance: number } | { balance: number }[] | null;
              const balance = Array.isArray(wallet) ? (wallet[0]?.balance ?? 0) : (wallet?.balance ?? 0);
              return (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#FFF5F8]">{u.name}</p>
                    <p className="text-xs text-[#5C5470]">{u.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-[#9B93B0]">{u.couple_code}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                        u.status === "linked"
                          ? "bg-[#34D399]/10 text-[#34D399]"
                          : "bg-white/5 text-[#5C5470]"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-sm text-[#9B93B0]">{balance} coin</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.is_admin ? (
                      <span className="rounded-full bg-[#FF3D7F]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#FF6B9D]">
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs text-[#5C5470]">User</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#5C5470]">
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
