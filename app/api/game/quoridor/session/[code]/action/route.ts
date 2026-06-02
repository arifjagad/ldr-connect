import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { QuoridorGameState } from "@/lib/types";

const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    r:    z.number().int().min(0).max(8),
    c:    z.number().int().min(0).max(8),
  }),
  z.object({
    type:        z.literal("wall"),
    orientation: z.enum(["H", "V"]),
    r:           z.number().int().min(0).max(7),
    c:           z.number().int().min(0).max(7),
  }),
]);

/** Fire-and-forget: broadcast game_state ke channel quoridor:{code} via Supabase REST */
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
 * POST /api/game/quoridor/session/[code]/action
 * Aksi pemain: gerak pion (move) atau pasang tembok (wall)
 * Memanggil stored function quoridor_action secara atomic,
 * lalu broadcast hasilnya langsung ke partner via Realtime (near-instant).
 */
export async function POST(
  request: NextRequest,
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

  // Validasi body
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.issues[0].message, data: null },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Request tidak valid", data: null },
      { status: 400 }
    );
  }

  const { code } = await params;
  const upperCode    = code.toUpperCase();
  const serviceClient = createServiceClient();

  // Siapkan payload untuk RPC
  const actionType = body.type;
  const payload =
    body.type === "move"
      ? { r: body.r, c: body.c }
      : { orientation: body.orientation, r: body.r, c: body.c };

  const { data: newState, error: rpcError } = await serviceClient.rpc("quoridor_action", {
    p_session_code: upperCode,
    p_user_id:      user.id,
    p_action_type:  actionType,
    p_payload:      payload,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_EXPIRED"))
      return NextResponse.json(
        { success: false, message: "Waktu sesi sudah habis", data: null },
        { status: 410 }
      );
    if (msg.includes("SESSION_NOT_FOUND"))
      return NextResponse.json(
        { success: false, message: "Sesi tidak ditemukan atau tidak aktif", data: null },
        { status: 404 }
      );
    if (msg.includes("NOT_IN_SESSION"))
      return NextResponse.json(
        { success: false, message: "Kamu bukan peserta sesi ini", data: null },
        { status: 403 }
      );
    if (msg.includes("NOT_YOUR_TURN"))
      return NextResponse.json(
        { success: false, message: "Bukan giliranmu", data: null },
        { status: 400 }
      );
    if (msg.includes("BLOCKED_BY_WALL"))
      return NextResponse.json(
        { success: false, message: "Jalur diblokir oleh tembok", data: null },
        { status: 400 }
      );
    if (msg.includes("WALL_OVERLAP"))
      return NextResponse.json(
        { success: false, message: "Posisi tembok sudah terpakai", data: null },
        { status: 400 }
      );
    if (msg.includes("WALL_BLOCKS_PATH"))
      return NextResponse.json(
        { success: false, message: "Tembok ini akan memblokir total jalur pemain — tidak diizinkan!", data: null },
        { status: 400 }
      );
    if (msg.includes("NO_WALLS_LEFT"))
      return NextResponse.json(
        { success: false, message: "Kamu sudah tidak punya tembok", data: null },
        { status: 400 }
      );
    if (msg.includes("INVALID_MOVE"))
      return NextResponse.json(
        { success: false, message: "Gerakan tidak valid", data: null },
        { status: 400 }
      );
    if (msg.includes("INVALID_WALL"))
      return NextResponse.json(
        { success: false, message: "Posisi tembok tidak valid", data: null },
        { status: 400 }
      );
    return NextResponse.json(
      { success: false, message: msg || "Gagal melakukan aksi", data: null },
      { status: 500 }
    );
  }

  const gs = newState as QuoridorGameState;

  // Broadcast langsung ke partner (fire-and-forget, tidak memblok response)
  // Partner menerima update via broadcast ~50ms, jauh lebih cepat dari postgres_changes WAL (~300-800ms)
  broadcastGameState(upperCode, gs);

  const message = gs.winner ? "Menang!" : "ok";
  return NextResponse.json({ success: true, message, data: { game_state: gs } });
}
