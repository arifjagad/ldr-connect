import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * GET /api/cron/capsule-delivery
 * Jalan setiap hari 00:00 UTC (07:00 WIB)
 * Ubah status locked → delivered untuk capsule yang opens_at <= hari ini
 * Kirim push notif ke receiver
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000); // UTC+7 (WIB)
  const today = nowWib.toISOString().split("T")[0]; // YYYY-MM-DD (WIB)

  // Ambil semua capsule yang sudah waktunya dibuka tapi masih locked
  const { data: capsules, error } = await serviceClient
    .from("capsules")
    .select("id, receiver_id, sender_id, opens_at, users!capsules_sender_id_fkey(name)")
    .eq("status", "locked")
    .eq("is_active", true)
    .lte("opens_at", today);

  if (error) {
    console.error("[cron/capsule-delivery] DB error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  let delivered = 0;
  let failed = 0;

  for (const cap of capsules ?? []) {
    // Update status ke delivered
    const { error: updateErr } = await serviceClient
      .from("capsules")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", cap.id);

    if (updateErr) {
      console.error(`[cron] Failed to deliver capsule ${cap.id}:`, updateErr.message);
      failed++;
      continue;
    }

    // Ambil nama sender
    const senderName = Array.isArray(cap.users)
      ? (cap.users[0] as { name: string } | undefined)?.name ?? "Partner"
      : (cap.users as { name: string } | null)?.name ?? "Partner";

    // Push notif ke receiver
    try {
      await sendPushToUser(cap.receiver_id, {
        title: "💌 Kapsul Waktumu sudah bisa dibuka!",
        body: `${senderName} mengirimkan sesuatu yang istimewa untukmu. Buka sekarang!`,
        url: "/dashboard/capsule",
        tag: `capsule-delivered-${cap.id}`,
      });
      delivered++;
      console.log(`[cron] ✓ Delivered capsule ${cap.id} to ${cap.receiver_id}`);
    } catch (e: any) {
      console.error(`[cron] ✗ Push failed for capsule ${cap.id}:`, e?.message);
      delivered++; // tetap count sebagai delivered meski push gagal
    }
  }

  return NextResponse.json({
    success: true,
    message: "Capsule delivery selesai",
    data: { delivered, failed, total: (capsules ?? []).length },
  });
}
