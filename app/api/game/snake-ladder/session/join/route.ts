import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/game/snake-ladder/session/join
 * Partner bergabung ke sesi snake_ladder di game_sessions
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  // Rate limit: cegah brute-force session_code + spam push notification ke host
  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint: "snake:session:join",
    maxRequests: 10,
    windowMinutes: 5,
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body: { code?: string } = {};
  try { body = await request.json(); } catch { /* ok */ }

  const code = (body.code ?? "").toUpperCase().trim();
  if (!code) {
    return NextResponse.json({ success: false, message: "Kode sesi diperlukan", data: null }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Pakai join_game_session RPC yang sudah ada (beroperasi di game_sessions)
  // RPC ini SUDAH menghitung expires_at dengan benar dari
  // game_settings.expires_in_minutes sesuai game_type sesi — jangan hitung
  // ulang/overwrite manual di sini (dulu ada duplikasi yang berisiko divergen
  // dari nilai RPC kalau expires_in_minutes di DB berubah tapi kode ini tidak).
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

  // Verifikasi ini memang sesi snake_ladder
  if (session.game_type && session.game_type !== "snake_ladder") {
    return NextResponse.json({ success: false, message: "Kode ini bukan untuk game Ular Tangga", data: null }, { status: 400 });
  }

  // Kirim push notification ke host
  const hostId = session?.host_user_id;
  if (hostId) {
    sendPushToUser(hostId, {
      title: "Partner sudah bergabung! 🎲",
      body: "Ular Tangga siap dimulai. Tap untuk main!",
      url: "/dashboard/games/snake-ladder",
      tag: `game-join-${code}`,
    }).catch((e) => console.error("[push] snake-ladder join failed:", e));
  }

  return NextResponse.json({ success: true, message: "Berhasil bergabung!", data: { session } });
}

