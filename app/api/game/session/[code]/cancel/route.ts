import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/game/session/[code]/cancel
 * Batalkan sesi game apapun oleh host — delegasi ke RPC cancel_game_session (atomic).
 */
export async function POST(
  _req: Request,
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

  const { error: rpcError } = await serviceClient.rpc("cancel_game_session", {
    p_session_code: code.toUpperCase(),
    p_user_id: user.id,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_NOT_FOUND"))
      return NextResponse.json({ success: false, message: "Sesi tidak ditemukan", data: null }, { status: 404 });
    if (msg.includes("NOT_HOST"))
      return NextResponse.json({ success: false, message: "Hanya host yang bisa membatalkan sesi", data: null }, { status: 403 });
    return NextResponse.json({ success: false, message: "Gagal membatalkan sesi", data: null }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Sesi berhasil dibatalkan dan coin dikembalikan",
    data: null,
  });
}
