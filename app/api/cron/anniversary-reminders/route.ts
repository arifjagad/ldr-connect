import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * GET /api/cron/anniversary-reminders
 * Dijalankan otomatis setiap hari pukul 08:00 WIB (01:00 UTC) via Vercel Cron.
 * Kirim push notification ke kedua partner pada H-7, H-3, H-1 sebelum anniversary.
 *
 * Dilindungi oleh CRON_SECRET agar tidak bisa dipanggil sembarangan.
 */
export async function GET(req: NextRequest) {
  // Verifikasi cron secret (Vercel otomatis kirim Authorization header)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Hitung tanggal target: hari ini + 1, 3, dan 7 hari ke depan (format MM-DD)
  // Kita bandingkan hanya MONTH dan DAY agar anniversary tahunan selalu cocok
  const today = new Date();
  const targets = [1, 3, 7].map((daysAhead) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysAhead);
    // Format: MM-DD (untuk matching tanggal tahunan)
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { daysAhead, monthDay: `${month}-${day}` };
  });

  console.log(
    `[cron/anniversary-reminders] Checking targets:`,
    targets.map((t) => `H-${t.daysAhead} (${t.monthDay})`).join(", ")
  );

  let totalSent = 0;
  let totalErrors = 0;

  for (const target of targets) {
    // Query semua anniversary aktif yang tanggalnya cocok (MM-DD)
    // Supabase: pakai to_char untuk ekstrak bulan-hari dari kolom DATE
    const { data: anniversaries, error } = await serviceClient
      .from("anniversaries")
      .select(`
        id,
        title,
        date,
        user_id,
        users!anniversaries_user_id_fkey (
          id,
          partner_id
        )
      `)
      .eq("is_active", true)
      // Filter by month-day: bandingkan to_char(date, 'MM-DD') = target
      // Supabase tidak support RPC filter langsung, pakai filter JS setelah fetch
      // tapi untuk efisiensi kita ambil semua is_active dulu lalu filter
      .not("user_id", "is", null);

    if (error) {
      console.error(`[cron] DB error for H-${target.daysAhead}:`, error.message);
      totalErrors++;
      continue;
    }

    // Filter di JS: cek apakah MM-DD dari kolom `date` cocok dengan target
    const matched = (anniversaries ?? []).filter((ann) => {
      // ann.date format: "YYYY-MM-DD"
      const parts = ann.date.split("-"); // ["YYYY", "MM", "DD"]
      const monthDay = `${parts[1]}-${parts[2]}`; // "MM-DD"
      return monthDay === target.monthDay;
    });

    console.log(
      `[cron] H-${target.daysAhead} (${target.monthDay}): ${matched.length} anniversary ditemukan`
    );

    for (const ann of matched) {
      const owner = Array.isArray(ann.users)
        ? (ann.users[0] as { id: string; partner_id: string | null } | undefined) ?? null
        : (ann.users as { id: string; partner_id: string | null } | null);
      if (!owner) continue;

      const { daysAhead } = target;

      // Label hari
      const dayLabel =
        daysAhead === 1 ? "besok!" : `${daysAhead} hari lagi`;

      // Emoji berdasarkan jarak hari
      const emoji =
        daysAhead === 1 ? "🌹" : daysAhead === 3 ? "💕" : "💌";

      // Pesan notifikasi
      const pushPayload = {
        title: `${emoji} Pengingat: ${ann.title}`,
        body: `${ann.title} ${dayLabel} — Jangan sampai terlupa, ya!`,
        url: "/dashboard/anniversaries",
        tag: `anniversary-reminder-${ann.id}-H${daysAhead}`,
      };

      // Kirim ke owner
      try {
        await sendPushToUser(owner.id, pushPayload);
        totalSent++;
        console.log(`[cron] ✓ Sent H-${daysAhead} reminder to owner ${owner.id} for "${ann.title}"`);
      } catch (e: any) {
        console.error(`[cron] ✗ Failed to send to owner ${owner.id}:`, e?.message);
        totalErrors++;
      }

      // Kirim ke partner juga (jika linked)
      if (owner.partner_id) {
        try {
          await sendPushToUser(owner.partner_id, pushPayload);
          totalSent++;
          console.log(`[cron] ✓ Sent H-${daysAhead} reminder to partner ${owner.partner_id} for "${ann.title}"`);
        } catch (e: any) {
          console.error(`[cron] ✗ Failed to send to partner ${owner.partner_id}:`, e?.message);
          totalErrors++;
        }
      }
    }
  }

  console.log(`[cron/anniversary-reminders] Done. sent=${totalSent} errors=${totalErrors}`);

  return NextResponse.json({
    success: true,
    message: `Reminder selesai`,
    data: { totalSent, totalErrors, checkedTargets: targets.map((t) => `H-${t.daysAhead}`) },
  });
}
