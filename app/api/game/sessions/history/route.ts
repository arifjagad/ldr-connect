import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/sessions/history
 * Ambil riwayat sesi game yang sudah selesai untuk user (sebagai host maupun partner)
 * Returns: { sessions: GameSession[], profiles: Record<string, string> }
 * profiles = map dari user_id → name (untuk host & partner)
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const serviceClient = createServiceClient();

  const now = new Date().toISOString();

  const { data: sessions, error } = await serviceClient
    .from("game_sessions")
    .select(
      "id, session_code, game_type, status, questions, game_state, coin_deducted, partner_joined_at, expires_at, created_at, host_user_id, partner_user_id"
    )
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .or(`status.in.(completed,expired,cancelled),and(status.eq.playing,expires_at.lt.${now})`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, data: null },
      { status: 500 }
    );
  }

  // Kumpulkan semua unique user IDs (host + partner) untuk ambil nama
  const userIds = new Set<string>();
  for (const s of sessions ?? []) {
    if (s.host_user_id) userIds.add(s.host_user_id);
    if (s.partner_user_id) userIds.add(s.partner_user_id);
  }

  // Fetch nama dari profiles
  const profiles: Record<string, string> = {};
  if (userIds.size > 0) {
    const { data: profileRows } = await serviceClient
      .from("users")
      .select("id, name, avatar_url")
      .in("id", [...userIds]);

    for (const row of profileRows ?? []) {
      profiles[row.id] = { name: row.name ?? "", avatar_url: row.avatar_url ?? null };
    }
  }

  return NextResponse.json({
    success: true,
    message: "Riwayat permainan",
    data: {
      sessions: sessions ?? [],
      profiles,
      currentUserId: user.id,
    },
  });
}
