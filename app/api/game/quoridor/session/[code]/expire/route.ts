import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteDailyRoom } from "@/lib/daily";

/**
 * POST /api/game/quoridor/session/[code]/expire
 * Tandai sesi sebagai expired — dipanggil dari client saat countdown habis
 */
export async function POST(
  _request: NextRequest,
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
  const serviceClient = createServiceClient();

  // PENTING: filter .lte("expires_at", now) + cek partisipan — tanpa filter
  // waktu ini, peserta yang sedang KALAH bisa memanggil endpoint ini kapan
  // saja untuk memaksa sesi jadi 'expired' dan menghindari kekalahan.
  // Tanpa cek partisipan, siapa pun yang tahu session_code bisa meng-expire
  // sesi orang lain (endpoint sebelumnya tidak mengecek host/partner sama sekali).
  const { data } = await serviceClient
    .from("game_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("session_code", code.toUpperCase())
    .eq("game_type", "quoridor")
    .in("status", ["playing", "waiting"])
    .lte("expires_at", new Date().toISOString())
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .select("session_code")
    .maybeSingle();

  if (data) {
    // Sesi benar-benar berakhir — hapus Daily.co room (best effort)
    deleteDailyRoom(code.toUpperCase());
  }

  return NextResponse.json({ success: true, message: "ok", data: null });
}
