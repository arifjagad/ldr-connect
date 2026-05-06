import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/session/any-active
 * Cek apakah couple punya sesi aktif di game manapun (waiting/playing).
 * Dipakai GameInviteNotification dan dashboard banner.
 * Returns: { session: { session_code, game_type, host_user_id, status } | null }
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

  const { data: session } = await serviceClient
    .from("game_sessions")
    .select("id, session_code, game_type, status, host_user_id, partner_user_id, expires_at")
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .in("status", ["waiting", "playing"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isHost = session ? session.host_user_id === user.id : false;

  return NextResponse.json({
    success: true,
    message: session ? "Sesi aktif ditemukan" : "Tidak ada sesi aktif",
    data: { session, is_host: isHost },
  });
}
