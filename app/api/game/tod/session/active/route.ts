import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/tod/session/active
 * Cek apakah couple punya sesi aktif (waiting/playing)
 * Returns: { session } or { session: null }
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
    p_user_id: user.id,
  });

  // supabase-js v2 wraps composite-type RPC results in an array
  const raw = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData ?? null;
  // PostgreSQL RETURNS composite mengembalikan object kosong (semua null)
  // saat tidak ada row — cek .id untuk memastikan ini sesi valid
  const session = raw?.id ? raw : null;

  return NextResponse.json({
    success: true,
    message: session ? "Sesi aktif ditemukan" : "Tidak ada sesi aktif",
    data: { session },
  });
}
