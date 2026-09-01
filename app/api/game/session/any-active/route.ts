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

  // Ambil data profile user untuk mengetahui partner_id
  const { data: profile } = await serviceClient
    .from("users")
    .select("partner_id")
    .eq("id", user.id)
    .single();

  const partnerId = profile?.partner_id;
  const coupleId = partnerId ? [user.id, partnerId].sort()[0] : null;

  // Bangun query filter yang mendukung pencarian by couple_id atau host_user_id
  let query = serviceClient
    .from("game_sessions")
    .select("id, session_code, game_type, status, host_user_id, partner_user_id, expires_at")
    .in("status", ["waiting", "playing"])
    .gt("expires_at", new Date().toISOString());

  if (coupleId) {
    query = query.or(`couple_id.eq.${coupleId},host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`);
  } else {
    query = query.or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`);
  }

  const { data: session } = await query
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
