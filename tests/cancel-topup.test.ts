import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Test untuk POST /api/coin/cancel-topup — sekarang route ini adalah thin
 * wrapper di atas lib/coin/cancel-topup.ts (cancelOrCreditPendingTopup),
 * yang logic intinya sudah diuji sendiri di tests/cancel-topup-shared.test.ts.
 * Test di sini fokus pada:
 * 1. Validasi ownership/status transaksi sebelum memanggil Midtrans sama sekali.
 * 2. Route memanggil cancelOrCreditPendingTopup dengan parameter yang benar.
 * 3. Route menangani ketiga outcome (cancelled, credited_as_paid, error) dengan benar,
 *    termasuk membedakan status HTTP 400 (business_error) vs 500 (system_error).
 */

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockCancelOrCreditPendingTopup = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceClient: vi.fn(() => ({
    rpc: mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/coin/cancel-topup", () => ({
  cancelOrCreditPendingTopup: mockCancelOrCreditPendingTopup,
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/coin/cancel-topup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function txRow(overrides: Partial<{
  id: number;
  user_id: string;
  type: string;
  payment_status: string;
  payment_reference: string | null;
  metadata: Record<string, unknown> | null;
}>) {
  return {
    id: 1,
    user_id: "user-1",
    type: "topup",
    payment_status: "pending",
    payment_reference: "TOPUP-1",
    metadata: { snap_token: "snap-token-1" },
    ...overrides,
  };
}

describe("POST /api/coin/cancel-topup", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetUser.mockReset();
    mockSingle.mockReset();
    mockCancelOrCreditPendingTopup.mockReset();
    mockRpc.mockReset();

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null }); // check_and_record_rate_limit — default allowed
    mockCancelOrCreditPendingTopup.mockResolvedValue({
      ok: true, outcome: "cancelled", message: "Transaksi top up berhasil dibatalkan",
    });
  });

  it("memanggil cancelOrCreditPendingTopup dengan transactionId, payment_reference & snap_token yang benar", async () => {
    mockSingle.mockResolvedValue({ data: txRow({ id: 1, payment_reference: "TOPUP-1" }), error: null });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 1 }));
    const json = await res.json();

    expect(mockCancelOrCreditPendingTopup).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 1,
        paymentReference: "TOPUP-1",
        userId: "user-1",
        snapToken: "snap-token-1",
      })
    );
    expect(json.success).toBe(true);
  });

  it("outcome 'credited_as_paid': response menandakan pembayaran sudah sukses", async () => {
    mockSingle.mockResolvedValue({ data: txRow({ id: 2, payment_reference: "TOPUP-2" }), error: null });
    mockCancelOrCreditPendingTopup.mockResolvedValue({ ok: true, outcome: "credited_as_paid" });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 2 }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data?.paid_instead_of_cancelled).toBe(true);
  });

  it("reason 'system_error': return 500", async () => {
    mockSingle.mockResolvedValue({ data: txRow({ id: 3, payment_reference: "TOPUP-3" }), error: null });
    mockCancelOrCreditPendingTopup.mockResolvedValue({ ok: false, reason: "system_error", message: "DB error" });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 3 }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
  });

  it("reason 'business_error': return 400", async () => {
    mockSingle.mockResolvedValue({ data: txRow({ id: 4, payment_reference: "TOPUP-4" }), error: null });
    mockCancelOrCreditPendingTopup.mockResolvedValue({ ok: false, reason: "business_error", message: "Transaksi sudah tidak pending" });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 4 }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("tetap berjalan normal jika transaksi tidak punya snap_token di metadata", async () => {
    mockSingle.mockResolvedValue({
      data: txRow({ id: 5, payment_reference: "TOPUP-5", metadata: null }),
      error: null,
    });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 5 }));
    const json = await res.json();

    expect(mockCancelOrCreditPendingTopup).toHaveBeenCalledWith(
      expect.objectContaining({ snapToken: undefined })
    );
    expect(json.success).toBe(true);
  });

  it("menolak transaksi yang bukan milik user (403), tidak memanggil Midtrans sama sekali", async () => {
    mockSingle.mockResolvedValue({ data: txRow({ id: 6, user_id: "other-user" }), error: null });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 6 }));

    expect(res.status).toBe(403);
    expect(mockCancelOrCreditPendingTopup).not.toHaveBeenCalled();
  });

  it("menolak transaksi yang sudah tidak pending (400), tidak memanggil Midtrans sama sekali", async () => {
    mockSingle.mockResolvedValue({ data: txRow({ id: 7, payment_status: "paid" }), error: null });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 7 }));

    expect(res.status).toBe(400);
    expect(mockCancelOrCreditPendingTopup).not.toHaveBeenCalled();
  });

  it("mengembalikan 401 jika tidak ada session user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });

    const { POST } = await import("@/app/api/coin/cancel-topup/route");
    const res = await POST(makeRequest({ transaction_id: 1 }));

    expect(res.status).toBe(401);
  });
});
