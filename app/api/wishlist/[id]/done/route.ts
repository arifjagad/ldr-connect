import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/wishlist/[id]/done
 * Tandai wishlist item sebagai selesai (kedua partner boleh)
 * Body: { done_note?: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const doneNote: string | undefined = body?.done_note;

  const serviceClient = createServiceClient();

  // Ambil data user (nama + partner_id)
  const { data: profile } = await serviceClient
    .from("users")
    .select("name, partner_id")
    .eq("id", user.id)
    .single();

  // Ambil item untuk validasi couple_id
  const { data: item, error: fetchErr } = await serviceClient
    .from("wishlists")
    .select("id, title, couple_id, is_done, created_by")
    .eq("id", id)
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ success: false, message: "Item tidak ditemukan", data: null }, { status: 404 });
  }

  if (item.is_done) {
    return NextResponse.json({ success: false, message: "Item sudah ditandai selesai", data: null }, { status: 409 });
  }

  // Pastikan user bagian dari couple ini
  const coupleId = user.id < (profile?.partner_id ?? "") ? user.id : (profile?.partner_id ?? "");
  if (item.couple_id !== coupleId) {
    return NextResponse.json({ success: false, message: "Tidak diizinkan", data: null }, { status: 403 });
  }

  const { data, error } = await serviceClient
    .from("wishlists")
    .update({
      is_done: true,
      done_by: user.id,
      done_at: new Date().toISOString(),
      done_note: doneNote?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  // Push notif ke partner
  const partnerId = profile?.partner_id;
  if (partnerId) {
    sendPushToUser(partnerId, {
      title: `🎉 ${profile?.name ?? "Partner"} menyelesaikan wishlist!`,
      body: item.title,
      url: "/dashboard/wishlist",
      tag: `wishlist-done-${id}`,
    }).catch((e) => console.error("[push] wishlist done failed:", e));
  }

  return NextResponse.json({ success: true, message: "Selamat! Wishlist berhasil diselesaikan 🎉", data });
}
