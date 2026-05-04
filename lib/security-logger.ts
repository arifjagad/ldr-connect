import { createServiceClient } from "@/lib/supabase/server";

/**
 * LOG-01: Centralized security event logger
 * Menulis ke tabel admin_activity_logs dengan prefix "security:" pada kolom action.
 * Dipanggil fire-and-forget — TIDAK PERNAH throw agar tidak mengganggu main flow.
 */

export type SecurityEvent =
  | "security:webhook_sig_fail"       // Midtrans webhook dengan signature tidak valid
  | "security:payment_ownership_violation" // verify dipanggil dengan payment_reference milik user lain
  | "security:game_access_denied"     // RPC menolak akses game (NOT_HOST, NOT_IN_SESSION)
  | "security:unauth_request";        // Request tanpa session ke protected endpoint

interface LogOptions {
  event: SecurityEvent;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Pick<Request, "headers">;
}

export function logSecurityEvent({ event, userId, metadata, req }: LogOptions): void {
  // Fire-and-forget: jangan await agar main request tidak tertunda
  void (async () => {
    try {
      const ip =
        req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req?.headers.get("x-real-ip") ??
        null;
      const ua = req?.headers.get("user-agent") ?? null;

      await createServiceClient()
        .from("admin_activity_logs")
        .insert({
          admin_user_id: userId ?? null,
          action: event,
          target_type: "security",
          metadata: metadata ?? null,
          ip_address: ip,
          user_agent: ua,
        });
    } catch {
      // Logging TIDAK BOLEH menggagalkan main request
    }
  })();
}
