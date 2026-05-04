import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SnakeGameState } from "@/lib/types";

/**
 * POST /api/game/snake/session/[code]/roll
 * Lempar dadu — delegasi ke RPC roll_snake_dice (atomic, WITH FOR UPDATE)
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

  const { data: newState, error: rpcError } = await serviceClient.rpc("roll_snake_dice", {
    p_session_code: code.toUpperCase(),
    p_user_id: user.id,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_EXPIRED")) {
      return NextResponse.json({ success: false, message: "Waktu sesi sudah habis", data: null }, { status: 410 });
    }
    if (msg.includes("SESSION_NOT_FOUND")) {
      return NextResponse.json({ success: false, message: "Sesi tidak ditemukan atau tidak aktif", data: null }, { status: 404 });
    }
    if (msg.includes("NOT_IN_SESSION")) {
      return NextResponse.json({ success: false, message: "Kamu bukan peserta sesi ini", data: null }, { status: 403 });
    }
    if (msg.includes("NOT_YOUR_TURN")) {
      return NextResponse.json({ success: false, message: "Bukan giliranmu", data: null }, { status: 400 });
    }
    if (msg.includes("PENDING_CHALLENGE")) {
      return NextResponse.json({ success: false, message: "Selesaikan tantangan dulu", data: null }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "Gagal update state", data: null }, { status: 500 });
  }

  const gs = newState as SnakeGameState;
  const message = gs.winner ? "Menang!" : "ok";

  return NextResponse.json({ success: true, message, data: { game_state: gs } });
}
