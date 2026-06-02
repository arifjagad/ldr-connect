import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

const postSchema = z.object({
  title:       z.string().min(1, "Judul tidak boleh kosong").max(200, "Judul maksimal 200 karakter").trim(),
  description: z.string().max(1000, "Deskripsi maksimal 1000 karakter").trim().optional(),
  category:    z.enum(["virtual", "offline", "dream", "gift", "other"]).default("other"),
});

/**
 * GET /api/wishlist
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("users").select("partner_id").eq("id", user.id).single();

  if (!profile?.partner_id) {
    return NextResponse.json({ success: true, message: "OK", data: [] });
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  const { data, error } = await serviceClient
    .from("wishlists")
    .select("*")
    .eq("couple_id", coupleId)
    .eq("is_active", true)
    .order("is_done", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "OK", data: data ?? [] });
}

/**
 * POST /api/wishlist
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

  const { title, description, category } = body;

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("users").select("partner_id, status, name").eq("id", user.id).single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json({ success: false, message: "Kamu belum terhubung dengan partner", data: null }, { status: 400 });
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  const { data, error } = await serviceClient
    .from("wishlists")
    .insert({ couple_id: coupleId, created_by: user.id, title, description: description || null, category })
    .select().single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  const categoryEmoji: Record<string, string> = { virtual: "🎮", offline: "✈️", dream: "🌙", gift: "🎁", other: "📌" };
  sendPushToUser(profile.partner_id, {
    title: `${categoryEmoji[category ?? "other"]} Wishlist baru dari ${profile.name}`,
    body: title,
    url: "/dashboard/wishlist",
    tag: `wishlist-new-${data.id}`,
  }).catch((e) => console.error("[push] wishlist new failed:", e));

  return NextResponse.json({ success: true, message: "Wishlist berhasil ditambahkan!", data });
}
