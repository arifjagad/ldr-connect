import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SnakeGameState } from "@/lib/types";

/**
 * POST /api/game/snake-ladder/session/[code]/confirm
 * Partner konfirmasi tantangan selesai — delegasi ke RPC confirm_snake_challenge (atomic)
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

  const { data: newState, error: rpcError } = await serviceClient.rpc("confirm_snake_challenge", {
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
    if (msg.includes("NO_PENDING_CHALLENGE")) {
      return NextResponse.json({ success: false, message: "Tidak ada tantangan yang perlu dikonfirmasi", data: null }, { status: 400 });
    }
    if (msg.includes("CANNOT_CONFIRM_OWN")) {
      return NextResponse.json({ success: false, message: "Kamu tidak bisa mengkonfirmasi tantanganmu sendiri", data: null }, { status: 403 });
    }
    if (msg.includes("NOT_IN_SESSION")) {
      return NextResponse.json({ success: false, message: "Kamu bukan peserta sesi ini", data: null }, { status: 403 });
    }
    return NextResponse.json({ success: false, message: "Gagal update state", data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Tantangan dikonfirmasi!", data: { game_state: newState as SnakeGameState } });
}
