import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const VOUCHER_CODE_RE = /^[A-Z0-9\-]{3,50}$/;

export async function POST(request: NextRequest) {
  // Auth check (anon client, baca session dari cookie)
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized", data: null },
      { status: 401 }
    );
  }

  // Rate limiting: maks 10 percobaan per 10 menit per user
  const rateLimitResult = await checkRateLimit(user.id, {
    endpoint: "coin/redeem-voucher",
    maxRequests: 10,
    windowMinutes: 10,
  });
  if (rateLimitResult) return rateLimitResult;

  // Parse dan validasi input
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request tidak valid", data: null },
      { status: 400 }
    );
  }

  const raw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!raw || !VOUCHER_CODE_RE.test(raw)) {
    return NextResponse.json(
      { success: false, message: "Format kode voucher tidak valid", data: null },
      { status: 400 }
    );
  }

  // Panggil stored procedure (service client untuk bypass RLS pada wallets & coin_transactions)
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("redeem_voucher", {
    p_user_id: user.id,
    p_code: raw,
  });

  if (error) {
    console.error("[redeem-voucher] RPC error:", error.message);
    return NextResponse.json(
      { success: false, message: "Gagal memproses voucher, coba lagi", data: null },
      { status: 500 }
    );
  }

  const result = data as { success: boolean; message: string; coin_value?: number };

  return NextResponse.json(
    {
      success: result.success,
      message: result.message,
      data: result.success ? { coin_value: result.coin_value } : null,
    },
    { status: result.success ? 200 : 400 }
  );
}
