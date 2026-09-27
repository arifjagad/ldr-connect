import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteDailyRoom } from "@/lib/daily";

/**
 * POST /api/game/photobooth/session/[code]/expire
 * Tandai sesi sebagai expired saat timer frontend habis.
 * Dipanggil client-side ketika countdown mencapai 0 (lihat handleTimerExpire
 * di app/dashboard/games/photobooth/page.tsx) — sebelumnya endpoint ini
 * TIDAK ADA sama sekali, membuat pemanggilan itu selalu 404 secara diam-diam
 * (fetch(...).catch(()=>{})), sehingga game_sessions.status tetap 'playing'
 * di DB walau UI sudah pindah ke fase finished.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const { code } = await params;
  const sessionCode = code.toUpperCase();
  const serviceClient = createServiceClient();

  // Filter .lte("expires_at", now) + cek partisipan — cegah peserta yang
  // sedang kalah memaksa sesi jadi 'expired' sebelum waktu benar-benar habis.
  const { data, error } = await serviceClient
    .from("game_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("session_code", sessionCode)
    .eq("game_type", "photobooth")
    .eq("status", "playing")
    .lte("expires_at", new Date().toISOString())
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .select("session_code, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ success: true, message: "Sesi tidak perlu diupdate", data: null });
  }

  // Sesi benar-benar berakhir — hapus Daily.co room (best effort)
  deleteDailyRoom(sessionCode);

  return NextResponse.json({ success: true, message: "Sesi ditandai expired", data });
}
