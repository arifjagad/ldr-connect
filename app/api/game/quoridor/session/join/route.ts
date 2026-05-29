import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * POST /api/game/quoridor/session/join
 * Partner bergabung ke sesi quoridor
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  let body: { code?: string } = {};
  try { body = await request.json(); } catch { /* ok */ }

  const code = (body.code ?? "").toUpperCase().trim();
  if (!code) {
    return NextResponse.json(
      { success: false, message: "Kode sesi diperlukan", data: null },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Ambil durasi game untuk update expires_at
  const { data: settings } = await serviceClient
    .from("game_settings")
    .select("expires_in_minutes")
    .eq("game_type", "quoridor")
    .single();
  const gameDurationMinutes = (settings as { expires_in_minutes?: number } | null)?.expires_in_minutes ?? 30;
  const expiresAt = new Date(Date.now() + gameDurationMinutes * 60 * 1000).toISOString();

  // Pakai join_game_session RPC yang sudah ada
  const { data: rpcData, error: rpcError } = await serviceClient.rpc("join_game_session", {
    p_partner_user_id: user.id,
    p_session_code:    code,
  });

  const session = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData;

  if (rpcError || !session) {
    const msg = rpcError?.message ?? "";
    if (msg.includes("SESSION_NOT_FOUND") || msg.includes("NOT_FOUND"))
      return NextResponse.json(
        { success: false, message: "Kode tidak valid atau sesi sudah tidak tersedia", data: null },
        { status: 404 }
      );
    if (msg.includes("CANNOT_JOIN_OWN"))
      return NextResponse.json(
        { success: false, message: "Kamu tidak bisa join sesimu sendiri", data: null },
        { status: 400 }
      );
    if (msg.includes("INSUFFICIENT_COINS"))
      return NextResponse.json(
        { success: false, message: "Saldo coin tidak cukup untuk bergabung", data: null },
        { status: 400 }
      );
    if (msg.includes("SESSION_EXPIRED"))
      return NextResponse.json(
        { success: false, message: "Sesi sudah kedaluwarsa", data: null },
        { status: 400 }
      );
    if (msg.includes("SESSION_NOT_WAITING")) {
      // Sudah playing — mungkin StrictMode double-invoke. Return sesi yang sudah ada.
      const { data: existing } = await serviceClient
        .from("game_sessions")
        .select("*")
        .eq("session_code", code)
        .eq("game_type", "quoridor")
        .in("status", ["playing"])
        .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
        .single();
      if (existing) {
        return NextResponse.json({
          success: true,
          message: "Sudah tergabung.",
          data:    { session: existing },
        });
      }
      return NextResponse.json(
        { success: false, message: "Sesi sudah penuh atau tidak tersedia", data: null },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: msg || "Gagal bergabung", data: null },
      { status: 500 }
    );
  }

  // Verifikasi ini memang sesi quoridor
  if (session.game_type && session.game_type !== "quoridor") {
    return NextResponse.json(
      { success: false, message: "Kode ini bukan untuk game Quoridor", data: null },
      { status: 400 }
    );
  }

  // Update expires_at dengan durasi game sesungguhnya
  await serviceClient
    .from("game_sessions")
    .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("session_code", code);

  const { data: updatedSession } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("session_code", code)
    .single();

  // Push notification ke host bahwa partner sudah join
  const hostId = (updatedSession ?? session)?.host_user_id;
  if (hostId) {
    sendPushToUser(hostId, {
      title: "Partner sudah bergabung! ♟️",
      body:  "Quoridor siap dimulai. Tap untuk main!",
      url:   "/dashboard/games/quoridor",
      tag:   `game-join-${code}`,
    }).catch((e) => console.error("[push] quoridor join failed:", e));
  }

  return NextResponse.json({
    success: true,
    message: "Berhasil bergabung!",
    data:    { session: updatedSession ?? session },
  });
}
