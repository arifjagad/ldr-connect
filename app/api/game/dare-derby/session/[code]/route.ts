import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/dare-derby/session/[code]
 * Ambil sesi Dare Derby by code
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const { code } = await params;
  const serviceClient = createServiceClient();

  const { data: session, error } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("session_code", code.toUpperCase())
    .eq("game_type", "dare_derby")
    .single();

  if (error || !session) {
    return NextResponse.json({ success: false, message: "Sesi tidak ditemukan", data: null }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "ok", data: { session } });
}
