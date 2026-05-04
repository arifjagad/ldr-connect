import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/snake/session/active
 * Ambil sesi snake_ladder aktif (waiting/playing) milik couple
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  // Ambil partner_id dulu
  const { data: profile } = await serviceClient
    .from("users")
    .select("partner_id")
    .eq("id", user.id)
    .single();

  if (!profile?.partner_id) {
    return NextResponse.json({ success: true, message: "ok", data: { session: null } });
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  const { data: session } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("couple_id", coupleId)
    .eq("game_type", "snake_ladder")
    .in("status", ["waiting", "playing"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ success: true, message: "ok", data: { session: session ?? null } });
}
