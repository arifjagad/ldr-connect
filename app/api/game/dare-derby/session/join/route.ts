import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * POST /api/game/dare-derby/session/join
 * Partner bergabung ke sesi Dare Derby
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  let body: { code?: string } = {};
  try { body = await request.json(); } catch { /* ok */ }

  const code = (body.code ?? "").toUpperCase().trim();
  if (!code) {
    return NextResponse.json({ success: false, message: "Kode sesi diperlukan", data: null }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const gameDurationMinutes = 60;
  const expiresAt = new Date(Date.now() + gameDurationMinutes * 60 * 1000).toISOString();

  const { data: rpcData, error: rpcError } = await serviceClient.rpc("join_game_session", {
    p_partner_user_id: user.id,
    p_session_code: code,
  });

  const session = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData;

  if (rpcError || !session) {
    const msg = rpcError?.message ?? "";
    if (msg.includes("SESSION_NOT_FOUND") || msg.includes("NOT_FOUND"))
      return NextResponse.json({ success: false, message: "Kode tidak valid atau sesi sudah tidak tersedia", data: null }, { status: 404 });
    if (msg.includes("CANNOT_JOIN_OWN"))
      return NextResponse.json({ success: false, message: "Kamu tidak bisa join sesimu sendiri", data: null }, { status: 400 });
    if (msg.includes("INSUFFICIENT_COINS"))
      return NextResponse.json({ success: false, message: "Saldo coin tidak cukup untuk bergabung", data: null }, { status: 400 });
    return NextResponse.json({ success: false, message: msg || "Gagal bergabung", data: null }, { status: 500 });
  }

  if (session.game_type && session.game_type !== "dare_derby") {
    return NextResponse.json({ success: false, message: "Kode ini bukan untuk game Dare Derby", data: null }, { status: 400 });
  }

  await serviceClient
    .from("game_sessions")
    .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("session_code", code);

  const { data: updatedSession } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("session_code", code)
    .single();

  // Kirim push notification ke host
  const hostId = (updatedSession ?? session)?.host_user_id;
  if (hostId) {
    sendPushToUser(hostId, {
      title: "Partner sudah bergabung! 🏁",
      body: "Dare Derby siap dimulai. Tap untuk main!",
      url: "/dashboard/games/dare-derby",
      tag: `game-join-${code}`,
    }).catch((e) => console.error("[push] dare-derby join failed:", e));
  }

  return NextResponse.json({ success: true, message: "Berhasil bergabung!", data: { session: updatedSession ?? session } });
}
