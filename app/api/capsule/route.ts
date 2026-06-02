import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

const postSchema = z.object({
  message:  z.string().min(1, "Pesan tidak boleh kosong").max(2000, "Pesan maksimal 2000 karakter").trim(),
  opens_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
});

/**
 * GET /api/capsule — list semua capsule milik user (sent + received)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("capsules")
    .select("*")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq("is_active", true)
    .order("opens_at", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  // Sensor isi pesan jika user adalah receiver & capsule masih locked
  const sanitized = (data ?? []).map((c) => {
    if (c.receiver_id === user.id && c.status === "locked") {
      return { ...c, message: null }; // sembunyikan isi
    }
    return c;
  });

  return NextResponse.json({ success: true, message: "OK", data: sanitized });
}

/**
 * POST /api/capsule — buat capsule baru
 * Body: { message: string, opens_at: string (YYYY-MM-DD) }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  let body: z.infer<typeof postSchema>;
  try {
    const raw = await req.json().catch(() => ({}));
    body = postSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: e.issues[0].message, data: null }, { status: 422 });
    }
    return NextResponse.json({ success: false, message: "Request tidak valid", data: null }, { status: 400 });
  }

  const { message, opens_at } = body;

  if (new Date(opens_at) <= new Date()) {
    return NextResponse.json({ success: false, message: "Tanggal buka harus di masa depan", data: null }, { status: 422 });
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("users")
    .select("partner_id, status, name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json({ success: false, message: "Kamu belum terhubung dengan partner", data: null }, { status: 400 });
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  const { data, error } = await serviceClient
    .from("capsules")
    .insert({
      sender_id: user.id,
      receiver_id: profile.partner_id,
      couple_id: coupleId,
      message: message.trim(),
      opens_at,
      status: "locked",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  // Notif ke receiver bahwa ada kapsul dikirim (tapi isinya disembunyikan)
  const opensDate = new Date(opens_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  sendPushToUser(profile.partner_id, {
    title: `💌 ${profile.name} mengirimkan Kapsul Waktu!`,
    body: `Kapsul terkunci sampai ${opensDate}. Ditunggu ya!`,
    url: "/dashboard/capsule",
    tag: `capsule-sent-${data.id}`,
  }).catch((e) => console.error("[push] capsule sent failed:", e));

  return NextResponse.json({ success: true, message: "Kapsul berhasil dikirim! 💌", data: { ...data, message: null } });
}
