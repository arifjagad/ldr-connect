import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/capsule/[id]/open
 * Receiver membuka kapsul yang sudah delivered
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Ambil capsule — pastikan user adalah receiver dan status delivered
  const { data: capsule, error: fetchErr } = await serviceClient
    .from("capsules")
    .select("*")
    .eq("id", id)
    .eq("receiver_id", user.id)
    .eq("status", "delivered")
    .single();

  if (fetchErr || !capsule) {
    return NextResponse.json({
      success: false,
      message: "Kapsul tidak ditemukan atau belum waktunya dibuka",
      data: null,
    }, { status: 404 });
  }

  const { data, error } = await serviceClient
    .from("capsules")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Kapsul berhasil dibuka! 🎉", data });
}
