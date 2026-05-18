import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/push/subscribe
 * Body: { endpoint, p256dh, auth }
 * Simpan atau update subscription push milik user yang sedang login.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated" }, { status: 401 });
  }

  let body: { endpoint?: string; p256dh?: string; auth?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const { endpoint, p256dh, auth } = body;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ success: false, message: "endpoint, p256dh, auth wajib diisi" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Upsert berdasarkan user_id + endpoint (unique constraint)
  const { error } = await serviceClient
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Subscription disimpan" });
}

/**
 * DELETE /api/push/subscribe
 * Body: { endpoint }
 * Hapus subscription push milik user.
 */
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated" }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  await serviceClient
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint ?? "");

  return NextResponse.json({ success: true, message: "Subscription dihapus" });
}
