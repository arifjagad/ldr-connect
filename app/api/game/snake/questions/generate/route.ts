import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/game/snake/questions/generate
 * Generate pertanyaan via OpenRouter (qwen/qwen3-coder:free) untuk board Ular Tangga
 * Body: { type?: "truth" | "dare" | "mix", category?: string, narasi?: string, count?: number }
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

type GeneratedQuestion = { type: "truth" | "dare"; question: string; category: string };

async function callOpenRouter(prompt: string): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY tidak dikonfigurasi");

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[OpenRouter] HTTP ${res.status} ${res.statusText}`);
    console.error(`[OpenRouter] Raw error body:`, errText);
    let friendlyMsg = "AI error";
    try {
      const errJson = JSON.parse(errText);
      const msg: string = errJson?.error?.message ?? errJson?.message ?? "";
      const code = errJson?.error?.code ?? errJson?.code ?? "";
      console.error(`[OpenRouter] Parsed — code: ${code}, message: ${msg}`);
      if (res.status === 429 || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit")) {
        friendlyMsg = "Kuota AI sedang habis. Coba lagi beberapa saat.";
      } else if (res.status === 400) {
        friendlyMsg = "Request ke AI tidak valid. Coba lagi.";
      } else if (res.status === 401 || res.status === 403) {
        friendlyMsg = "API key tidak valid atau tidak punya akses.";
      } else {
        friendlyMsg = msg || `HTTP ${res.status}`;
      }
    } catch (parseErr) {
      console.error(`[OpenRouter] Gagal parse error JSON:`, parseErr);
      friendlyMsg = `HTTP ${res.status}: ${errText.slice(0, 100)}`;
    }
    console.error(`[OpenRouter] friendlyMsg =>`, friendlyMsg);
    throw new Error(friendlyMsg);
  }

  console.log(`[OpenRouter] Response OK, parsing content...`);

  const json = await res.json();
  const rawText: string = json?.choices?.[0]?.message?.content ?? "";

  const jsonMatch =
    rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    rawText.match(/(\[[\s\S]*\])/);

  const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();

  let parsed: GeneratedQuestion[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Gagal memparse respons AI. Coba lagi.");
  }

  if (!Array.isArray(parsed)) throw new Error("Format respons AI tidak valid");

  return parsed.filter(
    (q) => q && typeof q.question === "string" && q.question.trim().length > 0
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  let body: { type?: string; category?: string; narasi?: string; count?: number } = {};
  try { body = await request.json(); } catch { /* ok */ }

  const type = body.type ?? "mix";
  const category = body.category ?? "romantis";
  const narasi = (body.narasi ?? "").trim();
  const count = Math.min(Math.max(body.count ?? 15, 10), 20);

  const typeInstruction =
    type === "truth" ? "semua harus bertipe truth (pertanyaan)"
    : type === "dare" ? "semua harus bertipe dare (tantangan)"
    : "campuran truth dan dare secara seimbang";

  const narasiSection = narasi
    ? `- Permintaan khusus dari pasangan ini: "${narasi}"\n  Jadikan ini sebagai konteks utama dalam membuat pertanyaan/tantangan.`
    : `- Tidak ada permintaan khusus, gunakan tema kategori secara umum.`;

  const prompt = `Kamu adalah asisten game untuk pasangan yang menjalani hubungan jarak jauh (LDR).
Buat ${count} pertanyaan/tantangan menarik dan seru untuk game Ular Tangga couple.
Ketentuan:
- Tipe: ${typeInstruction}
- Kategori/tema: ${category}
${narasiSection}
- Bahasa Indonesia yang santai dan natural
- Untuk truth: pertanyaan yang membuka diri, jujur, atau romantis
- Untuk dare: tantangan yang bisa dilakukan jarak jauh lewat video call (foto, video, suara, gerakan fisik)
- Sesuaikan untuk pasangan LDR yang sedang video call bersama
- Jangan terlalu vulgar, tetap sopan tapi bisa seru dan romantis
- Variasikan tingkat kesulitan dan kedalaman pertanyaan

Kembalikan HANYA array JSON dengan format:
[
  {"type": "truth", "question": "...", "category": "${category}"},
  {"type": "dare", "question": "...", "category": "${category}"}
]
Jangan tambahkan teks lain selain JSON.`;

  let questions: GeneratedQuestion[];
  try {
    questions = await callOpenRouter(prompt);
  } catch (e) {
    return NextResponse.json(
      { success: false, message: (e as Error).message, data: null },
      { status: 502 }
    );
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { success: false, message: "AI tidak menghasilkan pertanyaan yang valid. Coba lagi.", data: null },
      { status: 502 }
    );
  }

  const validated = questions
    .map((q) => ({
      type: (q.type === "dare" ? "dare" : "truth") as "truth" | "dare",
      question: String(q.question).trim(),
      category: String(q.category ?? category).trim(),
    }))
    .slice(0, count);

  return NextResponse.json({
    success: true,
    message: `${validated.length} pertanyaan berhasil digenerate`,
    data: { questions: validated },
  });
}
