import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { withSignedPhotoUrls } from "@/lib/games/photobooth/storage";
import type { PhotoboothSession } from "@/lib/types";

/**
 * GET /api/game/photobooth/session/active
 * Cek apakah couple punya sesi Photobooth aktif (waiting/playing)
 *
 * Sebelumnya route ini meng-UPDATE sendiri semua sesi user yang lewat
 * expires_at menjadi 'expired' — tanpa filter game_type dan tanpa refund.
 * Membuka halaman Photobooth menghanguskan coin sesi 'waiting' game lain,
 * dan cron expire-sessions tidak bisa me-refund-nya lagi karena statusnya
 * sudah bukan 'waiting'. Sekarang read-only via get_active_session_for_couple
 * (sama seperti game lain); expire + refund ditangani RPC create_game_session
 * dan cron expire-sessions.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const serviceClient = createServiceClient();
  const { data: rpcData } = await serviceClient.rpc("get_active_session_for_couple", {
    p_user_id:   user.id,
    p_game_type: "photobooth",
  });

  // RETURNS composite: dibungkus array oleh supabase-js, dan berisi row
  // kosong (semua null) saat tidak ada sesi — cek .id.
  const raw = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData ?? null;
  const session = (raw?.id ? raw : null) as PhotoboothSession | null;

  return NextResponse.json({
    success: true,
    message: session ? "Sesi aktif ditemukan" : "Tidak ada sesi aktif",
    data: { session: await withSignedPhotoUrls(session) },
  });
}
