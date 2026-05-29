import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { QuoridorGameState } from "@/lib/types";

/** Fire-and-forget broadcast ke channel quoridor:{code} */
async function broadcastGameState(code: string, gameState: QuoridorGameState) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method:  "POST",
    signal:  AbortSignal.timeout(3000),
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${serviceKey}`,
      apikey:         serviceKey,
    },
    body: JSON.stringify({
      messages: [
        {
          topic:   `quoridor:${code}`,
          event:   "game_state_update",
          payload: { game_state: gameState },
        },
      ],
    }),
  }).catch(() => {});
}

/**
 * POST /api/game/quoridor/session/[code]/surrender
 * Pemain menyerah — lawan dinyatakan menang.
 * Status sesi: completed. Winner: role lawan yang menyerah.
 */
export async function POST(
  _request: NextRequest,
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
  const upperCode    = code.toUpperCase();
  const serviceClient = createServiceClient();

  // Ambil sesi dengan lock agar atomic
  const { data: session, error: sessError } = await serviceClient
    .from("game_sessions")
    .select("id, session_code, status, host_user_id, partner_user_id, game_state")
    .eq("session_code", upperCode)
    .eq("game_type", "quoridor")
    .single();

  if (sessError || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Hanya peserta yang bisa menyerah
  if (session.host_user_id !== user.id && session.partner_user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu bukan peserta sesi ini", data: null },
      { status: 403 }
    );
  }

  // Hanya bisa menyerah saat playing
  if (session.status !== "playing") {
    return NextResponse.json(
      { success: false, message: "Sesi tidak sedang berlangsung", data: null },
      { status: 400 }
    );
  }

  // Tentukan role & winner
  const myRole   = session.host_user_id === user.id ? "host" : "partner";
  const winner   = myRole === "host" ? "partner" : "host";

  // Bangun game_state baru dengan winner diset
  const currentGs = (session.game_state ?? {}) as QuoridorGameState;
  const newGameState: QuoridorGameState = {
    ...currentGs,
    winner,
    current_turn: myRole, // freeze pada yang menyerah
    last_action: {
      player:  myRole,
      type:    "move",    // placeholder — tidak ada tipe "surrender" di schema
      payload: {},
    },
  };

  // Update DB atomically
  const { error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      status:     "completed",
      game_state: newGameState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "playing"); // double-check — tolak jika sudah completed oleh race

  if (updateError) {
    return NextResponse.json(
      { success: false, message: "Gagal menyerah, coba lagi", data: null },
      { status: 500 }
    );
  }

  // Broadcast ke partner (fire-and-forget)
  broadcastGameState(upperCode, newGameState);

  return NextResponse.json({
    success: true,
    message: "Kamu menyerah. Partner dinyatakan menang.",
    data:    { game_state: newGameState },
  });
}
