import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteDailyRoom } from "@/lib/daily";

/**
 * POST /api/game/snake-ladder/session/[code]/expire
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const { code } = await params;
  const serviceClient = await createServiceClient();

  // PENTING: filter .lte("expires_at", now) — tanpa ini, peserta yang sedang
  // KALAH bisa memanggil endpoint ini kapan saja selama status masih
  // 'playing' untuk memaksa sesi jadi 'expired' (menghindari kekalahan)
  // tanpa waktu benar-benar habis di server.
  const { data, error } = await serviceClient
    .from("game_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("session_code", code.toUpperCase())
    .eq("game_type", "snake_ladder")
    .eq("status", "playing")
    .lte("expires_at", new Date().toISOString())
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .select("session_code, status")
    .single();

  if (error || !data) {
    // Bisa jadi sesi sudah tidak playing lagi, atau waktu belum benar-benar
    // habis di server — bukan error yang perlu ditampilkan ke user.
    return NextResponse.json({ success: true, message: "Sesi tidak perlu diupdate", data: null });
  }

  // Sesi benar-benar berakhir — hapus Daily.co room (best effort)
  deleteDailyRoom(code.toUpperCase());

  return NextResponse.json({ success: true, message: "Sesi di-expire", data });
}
