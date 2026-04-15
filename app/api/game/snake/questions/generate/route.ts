import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/game/snake/questions/generate
 * Generate 15 pertanyaan via Gemini AI untuk board Ular Tangga
 * Body: { type?: "truth" | "dare" | "mix", category?: string, count?: number }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  let body: { type?: string; category?: string; narasi?: string; count?: number } = {};
  try { body = await request.json(); } catch { /* ok */ }

  const type = body.type ?? "mix";
  const category = body.category ?? "umum";
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

Kembalikan JSON array berformat:
[
  {"type": "truth", "question": "...", "category": "${category}"},
  {"type": "dare", "question": "...", "category": "${category}"}
]
Hanya kembalikan JSON array saja, tanpa teks lain.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: "Gemini API key tidak dikonfigurasi", data: null }, { status: 500 });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json({ success: false, message: "Gemini API error", data: null }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract JSON dari response (bisa terbungkus markdown code fence)
    const jsonMatch =
      rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawText.match(/(\[[\s\S]*\])/);

    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
    const questions = JSON.parse(jsonStr);

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, message: "Format respons AI tidak valid", data: null }, { status: 500 });
    }

    // Validasi & normalisasi
    const validated = questions
      .filter((q) => q.type && q.question)
      .map((q) => ({
        type: q.type === "dare" ? "dare" : "truth",
        question: String(q.question).trim(),
        category: String(q.category ?? category).trim(),
      }))
      .slice(0, count);

    return NextResponse.json({
      success: true,
      message: `${validated.length} pertanyaan berhasil digenerate`,
      data: { questions: validated },
    });
  } catch (err) {
    console.error("Gemini error:", err);
    return NextResponse.json({ success: false, message: "Gagal memproses respons AI", data: null }, { status: 500 });
  }
}
