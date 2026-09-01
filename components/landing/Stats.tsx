import { createServiceClient } from "@/lib/supabase/server";

function formatMetricNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K+`;
  }
  if (num > 0) {
    return `${num}+`;
  }
  return "0";
}

export async function Stats() {
  let couplesCount = 0;
  let gamesCount = 4;
  let sessionsCount = 0;

  try {
    const supabase = createServiceClient();

    const [
      { count: linkedUsers },
      { count: activeGames },
      { count: totalSessions },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "linked"),
      supabase.from("game_settings").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("game_sessions").select("*", { count: "exact", head: true }),
    ]);

    // 2 user linked = 1 pasangan
    couplesCount = Math.floor((linkedUsers ?? 0) / 2);
    gamesCount = activeGames ?? 4;
    sessionsCount = totalSessions ?? 0;
  } catch {
    // Fallback jika fetch gagal
    couplesCount = 0;
    gamesCount = 4;
    sessionsCount = 0;
  }

  const metrics = [
    {
      value: formatMetricNumber(couplesCount),
      label: "Pasangan Aktif",
    },
    {
      value: `${gamesCount} Game`,
      label: "Tersedia Hari Ini",
    },
    {
      value: formatMetricNumber(sessionsCount),
      label: "Sesi Dimainkan",
    },
    {
      value: "100%",
      label: "Gratis Daftar",
    },
  ];

  return (
    <section className="border-y border-[#E7E5E4] bg-[#FBF0ED]/40 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {metrics.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="font-editorial text-3xl font-medium tracking-tight text-[#C84B31] sm:text-4xl">
                {item.value}
              </div>
              <div className="mt-1 text-xs font-medium text-[#78716C]">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
