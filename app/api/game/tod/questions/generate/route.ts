import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/game/tod/questions/generate
 * Generate pertanyaan ToD menggunakan Gemini AI.
 * source = 'ai', is_active = true (langsung aktif, tanpa approval)
 *
 * Body: { type?: "truth"|"dare"|"both", category: string, count?: number }
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

type GeminiQuestion = { type: "truth" | "dare"; question: string };

async function callGemini(prompt: string): Promise<GeminiQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi");

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const json = await res.json();
  const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Ekstrak JSON dari respons (Gemini kadang wrap dalam ```json ... ```)
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) ?? rawText.match(/(\[[\s\S]*\])/);
  const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

  let parsed: GeminiQuestion[];
  try {
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    throw new Error("Gagal memparse respons AI. Coba lagi.");
  }

  // Validasi format
  if (!Array.isArray(parsed)) throw new Error("Format respons AI tidak valid");

  return parsed.filter(
    (q) =>
      q &&
      typeof q.question === "string" &&
      q.question.trim().length > 0 &&
      (q.type === "truth" || q.type === "dare")
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  let body: { type?: string; category?: string; count?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const typeInput = body.type ?? "both";
  const category = body.category?.trim() || "romantis";
  const count = Math.min(Math.max(body.count ?? 5, 3), 10);

  if (typeInput !== "both" && !["truth", "dare"].includes(typeInput)) {
    return NextResponse.json(
      { success: false, message: "type harus 'truth', 'dare', atau 'both'", data: null },
      { status: 422 }
    );
  }

  // Pastikan user sudah linked
  const { data: profile } = await supabase
    .from("users")
    .select("partner_id, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json(
      { success: false, message: "Kamu belum terhubung dengan partner", data: null },
      { status: 400 }
    );
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  // Buat prompt untuk Gemini
  const typeDesc =
    typeInput === "both"
      ? `campuran (truth dan dare, sekitar setengah-setengah)`
      : typeInput === "truth"
      ? "Truth (jujur jawab pertanyaan)"
      : "Dare (tantangan aksi)";

  const prompt = `Kamu adalah pembuat pertanyaan Truth or Dare untuk pasangan yang menjalani hubungan jarak jauh (LDR).

Buat ${count} pertanyaan ${typeDesc} dengan tema/kategori: "${category}".

Aturan:
- Semua pertanyaan dalam Bahasa Indonesia
- Pertanyaan harus intim, romantis, dan sesuai untuk pasangan dewasa
- Truth: pertanyaan yang menggali perasaan, kenangan, atau kejujuran tentang hubungan
- Dare: tantangan yang bisa dilakukan jarak jauh (video call, kirim foto, rekam video, dsb.)
- Jangan buat pertanyaan yang vulgar atau tidak sopan
- Setiap pertanyaan harus unik dan personal

Kembalikan HANYA array JSON dengan format:
[
  {"type": "truth", "question": "..."},
  {"type": "dare", "question": "..."}
]

Jangan tambahkan teks lain selain JSON.`;

  let generated: GeminiQuestion[];
  try {
    generated = await callGemini(prompt);
  } catch (e) {
    return NextResponse.json(
      { success: false, message: (e as Error).message, data: null },
      { status: 502 }
    );
  }

  if (generated.length === 0) {
    return NextResponse.json(
      { success: false, message: "AI tidak menghasilkan pertanyaan yang valid. Coba lagi.", data: null },
      { status: 502 }
    );
  }

  // Bulk insert ke database
  const serviceClient = createServiceClient();
  const rows = generated.map((q) => ({
    couple_id: coupleId,
    type: q.type,
    category,
    question: q.question.trim(),
    source: "ai" as const,
    is_active: true,  // AI questions langsung aktif
    created_by: user.id,
  }));

  const { data: inserted, error: insertError } = await serviceClient
    .from("game_tod_questions")
    .insert(rows)
    .select("id, type, category, question, source, is_active, created_at");

  if (insertError) {
    return NextResponse.json(
      { success: false, message: insertError.message, data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `${inserted?.length ?? 0} pertanyaan berhasil digenerate dan langsung aktif!`,
    data: { questions: inserted ?? [] },
  });
}
