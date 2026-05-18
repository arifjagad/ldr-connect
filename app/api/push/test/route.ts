import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * POST /api/push/test
 * Debug endpoint: kirim push notification ke user yang sedang login
 * Body: { title?, body? }
 * 
 * Hanya untuk debugging — hapus setelah production OK
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated" }, { status: 401 });
  }

  let body: { title?: string; body?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  console.log("[push/test] Sending test push to user:", user.id);
  console.log("[push/test] VAPID_PUBLIC_KEY:", process.env.VAPID_PUBLIC_KEY?.slice(0, 20) + "...");
  console.log("[push/test] VAPID_EMAIL:", process.env.VAPID_EMAIL);

  try {
    await sendPushToUser(user.id, {
      title: body.title ?? "Test Notifikasi 🔔",
      body: body.body ?? "Push notification berhasil! LDR-Connect",
      url: "/dashboard",
      tag: "push-test",
    });
    return NextResponse.json({ success: true, message: "Push dikirim" });
  } catch (err: any) {
    console.error("[push/test] Error:", err);
    return NextResponse.json({ success: false, message: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
