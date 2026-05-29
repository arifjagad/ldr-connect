import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/game/quoridor/session/[code]/expire
 * Tandai sesi sebagai expired — dipanggil dari client saat countdown habis
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
  const serviceClient = createServiceClient();

  await serviceClient
    .from("game_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("session_code", code.toUpperCase())
    .eq("game_type", "quoridor")
    .in("status", ["playing", "waiting"]);

  return NextResponse.json({ success: true, message: "ok", data: null });
}
