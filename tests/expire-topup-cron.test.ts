import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Test untuk GET /api/cron/expire-topup — fokus pada:
 * 1. Auth via CRON_SECRET (pola sama dengan cron lain, lihat tests/cron-security.test.ts).
 * 2. Route memanggil cancelOrCreditPendingTopup untuk setiap transaksi pending
 *    yang melewati cutoff 60 menit, dan menghitung outcome dengan benar.
 * 3. Satu transaksi gagal tidak menggagalkan proses transaksi lainnya.
 */

const mockLt = vi.fn();
const mockCancelOrCreditPendingTopup = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            lt: mockLt,
          }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/coin/cancel-topup", () => ({
  cancelOrCreditPendingTopup: mockCancelOrCreditPendingTopup,
}));

function makeRequest(authHeader?: string) {
  return new NextRequest("http://localhost:3000/api/cron/expire-topup", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/expire-topup", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, CRON_SECRET: "test-cron-secret" };
    mockLt.mockReset();
    mockCancelOrCreditPendingTopup.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("menolak 401 jika tidak ada Authorization header", async () => {
    const { GET } = await import("@/app/api/cron/expire-topup/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("menolak 401 jika token salah", async () => {
    const { GET } = await import("@/app/api/cron/expire-topup/route");
    const res = await GET(makeRequest("Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("fail-closed (401) jika CRON_SECRET kosong di server meski token diberikan", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/expire-topup/route");
    const res = await GET(makeRequest("Bearer any-token"));
    expect(res.status).toBe(401);
  });

  it("memproses semua transaksi pending > 60 menit dan menghitung outcome dengan benar", async () => {
    mockLt.mockResolvedValue({
      data: [
        { id: 1, user_id: "user-1", payment_reference: "TOPUP-1", metadata: { snap_token: "s1" } },
        { id: 2, user_id: "user-2", payment_reference: "TOPUP-2", metadata: null },
        { id: 3, user_id: "user-3", payment_reference: "TOPUP-3", metadata: null },
      ],
      error: null,
    });
    mockCancelOrCreditPendingTopup
      .mockResolvedValueOnce({ ok: true, outcome: "cancelled", message: "dibatalkan" })
      .mockResolvedValueOnce({ ok: true, outcome: "credited_as_paid" })
      .mockResolvedValueOnce({ ok: false, reason: "system_error", message: "midtrans down" });

    const { GET } = await import("@/app/api/cron/expire-topup/route");
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockCancelOrCreditPendingTopup).toHaveBeenCalledTimes(3);
    expect(mockCancelOrCreditPendingTopup).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 1, paymentReference: "TOPUP-1", userId: "user-1", snapToken: "s1" })
    );
    expect(json.data).toEqual({ cancelled: 1, creditedAsPaid: 1, failed: 1, total: 3 });
  });

  it("satu transaksi throw exception tidak menghentikan proses transaksi lainnya", async () => {
    mockLt.mockResolvedValue({
      data: [
        { id: 1, user_id: "user-1", payment_reference: "TOPUP-1", metadata: null },
        { id: 2, user_id: "user-2", payment_reference: "TOPUP-2", metadata: null },
      ],
      error: null,
    });
    mockCancelOrCreditPendingTopup
      .mockRejectedValueOnce(new Error("unexpected crash"))
      .mockResolvedValueOnce({ ok: true, outcome: "cancelled", message: "dibatalkan" });

    const { GET } = await import("@/app/api/cron/expire-topup/route");
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const json = await res.json();

    expect(mockCancelOrCreditPendingTopup).toHaveBeenCalledTimes(2);
    expect(json.data).toEqual({ cancelled: 1, creditedAsPaid: 0, failed: 1, total: 2 });
  });

  it("mengembalikan 500 jika query DB gagal", async () => {
    mockLt.mockResolvedValue({ data: null, error: { message: "connection lost" } });

    const { GET } = await import("@/app/api/cron/expire-topup/route");
    const res = await GET(makeRequest("Bearer test-cron-secret"));

    expect(res.status).toBe(500);
    expect(mockCancelOrCreditPendingTopup).not.toHaveBeenCalled();
  });

  it("tidak ada transaksi pending: total 0, tidak error", async () => {
    mockLt.mockResolvedValue({ data: [], error: null });

    const { GET } = await import("@/app/api/cron/expire-topup/route");
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.total).toBe(0);
  });
});
