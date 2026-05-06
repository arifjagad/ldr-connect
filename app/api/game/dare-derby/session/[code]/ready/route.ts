import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DareDerbyGameState } from "@/lib/types";

/**
 * POST /api/game/dare-derby/session/[code]/ready
 * Player tap "Siap!" — delegasi ke RPC ready_up_dare_derby (atomic)
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
  const serviceClient = createServiceClient();

  const { data: newState, error: rpcError } = await serviceClient.rpc("ready_up_dare_derby", {
    p_session_code: code.toUpperCase(),
    p_user_id: user.id,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_EXPIRED"))
      return NextResponse.json({ success: false, message: "Waktu sesi sudah habis", data: null }, { status: 410 });
    if (msg.includes("SESSION_NOT_FOUND"))
      return NextResponse.json({ success: false, message: "Sesi tidak ditemukan", data: null }, { status: 404 });
    if (msg.includes("SESSION_NOT_ACTIVE"))
      return NextResponse.json({ success: false, message: "Partner belum join sesi", data: null }, { status: 400 });
    if (msg.includes("WRONG_PHASE"))
      return NextResponse.json({ success: false, message: "Game sudah dimulai", data: null }, { status: 400 });
    if (msg.includes("NOT_IN_SESSION"))
      return NextResponse.json({ success: false, message: "Kamu bukan peserta sesi ini", data: null }, { status: 403 });
    return NextResponse.json({ success: false, message: "Gagal update state", data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Siap!", data: { game_state: newState as DareDerbyGameState } });
}
