import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/game/snake-ladder/session/[code]/expire
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const { code } = await params;
  const serviceClient = await createServiceClient();

  const { data, error } = await serviceClient
    .from("game_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("session_code", code.toUpperCase())
    .eq("game_type", "snake_ladder")
    .eq("status", "playing")
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .select("session_code, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, message: "Gagal expire sesi", data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Sesi di-expire", data });
}
