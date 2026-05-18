import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * POST /api/game/tod/session/join
 * Partner join sesi yang sudah dibuat host
 *
 * Body: { session_code: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Parse body
  let body: { session_code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body tidak valid", data: null },
      { status: 400 }
    );
  }

  const { session_code } = body;
  if (!session_code?.trim()) {
    return NextResponse.json(
      { success: false, message: "session_code wajib diisi", data: null },
      { status: 422 }
    );
  }

  const serviceClient = createServiceClient();
  const { data: rpcData, error: rpcError } = await serviceClient.rpc("join_game_session", {
    p_partner_user_id: user.id,
    p_session_code: session_code.trim().toUpperCase(),
  });

  // supabase-js v2 wraps composite-type RPC results in an array
  const session = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData;

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_NOT_FOUND")) {
      return NextResponse.json(
        { success: false, message: "Sesi tidak ditemukan", data: null },
        { status: 404 }
      );
    }
    if (msg.includes("SESSION_NOT_WAITING")) {
      return NextResponse.json(
        { success: false, message: "Sesi tidak dalam status menunggu partner", data: null },
        { status: 409 }
      );
    }
    if (msg.includes("CANNOT_JOIN_OWN_SESSION")) {
      return NextResponse.json(
        { success: false, message: "Kamu tidak bisa join sesi milikmu sendiri", data: null },
        { status: 400 }
      );
    }
    if (msg.includes("SESSION_EXPIRED")) {
      return NextResponse.json(
        { success: false, message: "Sesi sudah expired", data: null },
        { status: 410 }
      );
    }
    if (msg.includes("INSUFFICIENT_COINS")) {
      return NextResponse.json(
        { success: false, message: "Saldo coin kamu tidak cukup untuk join sesi ini", data: null },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { success: false, message: msg || "Gagal join sesi", data: null },
      { status: 500 }
    );
  }

  // Kirim push notification ke host
  const hostId = session?.host_user_id;
  if (hostId) {
    sendPushToUser(hostId, {
      title: "Partner sudah bergabung! 🔥",
      body: "Truth or Dare siap dimulai. Tap untuk main!",
      url: "/dashboard/games/tod",
      tag: `game-join-${session_code}`,
    }).catch((e) => console.error("[push] tod join failed:", e)); // fire-and-forget
  }

  return NextResponse.json({
    success: true,
    message: "Berhasil join sesi! Permainan dimulai.",
    data: { session },
  });
}
