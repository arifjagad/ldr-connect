import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { deleteDailyRoom } from "@/lib/daily";

/**
 * GET /api/cron/expire-sessions
 * Jalan 1x/hari via Vercel Cron (lihat vercel.json).
 *
 * Jaring pengaman untuk sesi game (game_sessions) yang "ditelantarkan":
 *
 * 1. Sesi 'waiting' yang sudah lewat expires_at (host membuat sesi tapi
 *    partner tidak pernah join, lalu host tidak pernah kembali membuat sesi
 *    baru maupun klik "Batalkan") — sebelumnya TIDAK PERNAH direfund sama
 *    sekali karena RPC expire_waiting_sessions() yang menangani ini tidak
 *    dipanggil oleh siapa pun (tidak ada cron/API route). Auto-expire yang
 *    terjadi di dalam create_game_session hanya jalan kalau salah satu
 *    pihak membuat sesi BARU — kalau tidak pernah, coin host tertahan
 *    selamanya di sesi 'waiting' yang membatu.
 * 2. Sesi 'playing' yang sudah lewat expires_at tapi frontend tidak pernah
 *    memanggil POST .../expire (tab ditutup sebelum timer client sempat
 *    fire, dsb.) — dibersihkan statusnya ke 'expired' (tanpa refund, sesuai
 *    desain: kedua pihak sudah "memakai" coin untuk main).
 *
 * Kedua kasus juga best-effort menghapus Daily.co room terkait (resource
 * cleanup) karena baik /done, /cancel, maupun timer client tidak akan lagi
 * berjalan untuk sesi yang sudah ditelantarkan ini.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // 1. Expire + refund sesi 'waiting' yang sudah lewat waktu (RPC atomik,
  //    FOR UPDATE SKIP LOCKED per baris — aman dipanggil bersamaan/berulang).
  const { data: waitingResult, error: waitingError } = await serviceClient.rpc(
    "expire_waiting_sessions"
  );

  if (waitingError) {
    console.error("[cron/expire-sessions] expire_waiting_sessions RPC error:", waitingError.message);
  }

  const waitingRows = (waitingResult ?? []) as Array<{ expired_session_id: number; refunded: boolean }>;
  const refundedCount = waitingRows.filter((r) => r.refunded).length;
  const refundFailedCount = waitingRows.length - refundedCount;

  // 2. Expire (tanpa refund) sesi 'playing' yang sudah lewat waktu tapi
  //    tidak pernah ditandai expired oleh client (tab ditutup, dsb).
  const { data: stalePlaying, error: playingError } = await serviceClient
    .from("game_sessions")
    .update({ status: "expired" })
    .eq("status", "playing")
    .lt("expires_at", new Date().toISOString())
    .select("id, session_code");

  if (playingError) {
    console.error("[cron/expire-sessions] update playing->expired error:", playingError.message);
  }

  // Best-effort cleanup Daily.co room untuk sesi yang baru di-expire di atas.
  const codesToCleanup: string[] = [];
  if (waitingRows.length > 0) {
    const { data: waitingSessions } = await serviceClient
      .from("game_sessions")
      .select("session_code")
      .in("id", waitingRows.map((r) => r.expired_session_id));
    codesToCleanup.push(...(waitingSessions ?? []).map((s) => s.session_code));
  }
  codesToCleanup.push(...(stalePlaying ?? []).map((s) => s.session_code));

  await Promise.all(codesToCleanup.map((code) => deleteDailyRoom(code).catch(() => {})));

  console.log(
    `[cron/expire-sessions] Done. waiting_expired=${waitingRows.length} refunded=${refundedCount} refund_failed=${refundFailedCount} playing_expired=${(stalePlaying ?? []).length}`
  );

  return NextResponse.json({
    success: true,
    message: "Expire sessions selesai",
    data: {
      waiting_expired: waitingRows.length,
      refunded: refundedCount,
      refund_failed: refundFailedCount,
      playing_expired: (stalePlaying ?? []).length,
    },
  });
}
