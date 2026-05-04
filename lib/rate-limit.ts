import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
}

/**
 * Cek rate limit via Supabase RPC (bekerja di serverless/multi-instance).
 * Returns null jika allowed, atau NextResponse 429 jika ditolak.
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const supabase = createServiceClient();

  const { data: allowed, error } = await supabase.rpc(
    "check_and_record_rate_limit",
    {
      p_user_id:        userId,
      p_endpoint:       config.endpoint,
      p_max_requests:   config.maxRequests,
      p_window_minutes: config.windowMinutes,
    }
  );

  if (error) {
    // Jika RPC gagal, biarkan request lewat (fail-open) agar tidak mengganggu UX
    console.error("[RateLimit] RPC error:", error.message);
    return null;
  }

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        message: `Terlalu banyak permintaan. Coba lagi dalam ${config.windowMinutes} menit.`,
        data: null,
      },
      { status: 429 }
    );
  }

  return null;
}
