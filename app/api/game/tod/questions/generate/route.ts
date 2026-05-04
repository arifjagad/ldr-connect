import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const bodySchema = z.object({
  type:     z.enum(["truth", "dare", "both"]).default("both"),
  category: z.string().min(1).max(50).default("romantis"),
  count:    z.number().int().min(3).max(10).default(5),
});

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

  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) ?? rawText.match(/(\[[\s\S]*\])/);
  const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

  let parsed: GeminiQuestion[];
  try {
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    throw new Error("Gagal memparse respons AI. Coba lagi.");
  }

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

  // Rate limit: 5 generate per 10 menit per user
  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint:       "tod:questions:generate",
    maxRequests:    5,
    windowMinutes:  10,
  });
  if (rateLimitResponse) return rateLimitResponse;

  // Validasi input dengan Zod
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.issues[0].message, data: null },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Request tidak valid", data: null },
      { status: 400 }
    );
  }

  const { type: typeInput, category, count } = body;

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

  const serviceClient = createServiceClient();
  const rows = generated.map((q) => ({
    couple_id:  coupleId,
    type:       q.type,
    category,
    question:   q.question.trim(),
    source:     "ai" as const,
    is_active:  true,
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
