import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/user/partner-profile
 * Ambil profil diri sendiri + partner (berdasarkan couple relationship).
 * Dipakai oleh layar hasil game untuk mengisi ShareResult card.
 *
 * Response:
 * {
 *   my:      { name: string; avatar_url: string | null }
 *   partner: { name: string; avatar_url: string | null } | null
 * }
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const service = createServiceClient();

  // Ambil data user sendiri (name, avatar_url, partner_id)
  const { data: me } = await service
    .from("users")
    .select("name, avatar_url, partner_id")
    .eq("id", user.id)
    .single();

  if (!me) {
    return NextResponse.json(
      { success: false, message: "User not found", data: null },
      { status: 404 }
    );
  }

  let partner: { name: string; avatar_url: string | null } | null = null;

  if (me.partner_id) {
    const { data: partnerRow } = await service
      .from("users")
      .select("name, avatar_url")
      .eq("id", me.partner_id)
      .single();

    if (partnerRow) {
      partner = {
        name: partnerRow.name ?? "",
        avatar_url: partnerRow.avatar_url ?? null,
      };
    }
  }

  return NextResponse.json({
    success: true,
    message: "OK",
    data: {
      my: {
        name: me.name ?? "",
        avatar_url: me.avatar_url ?? null,
      },
      partner,
    },
  });
}
