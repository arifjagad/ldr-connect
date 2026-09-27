import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Test untuk POST /api/coin/topup — fokus pada 2 perbaikan:
 * 1. (Window A) Pembuatan transaksi + apply voucher diskon sekarang atomik
 *    lewat RPC create_pending_topup — route ini cukup memanggilnya sekali,
 *    tidak ada lagi 2 langkah terpisah (apply_topup_discount lalu insert manual).
 * 2. (Window B) Jika Midtrans Snap API gagal SETELAH transaksi & voucher
 *    redemption sudah dibuat, route ini WAJIB rollback (panggil
 *    cancelOrCreditPendingTopup) supaya voucher tidak hangus menunggu cron.
 */

const mockGetUser = vi.fn();
const mockPackageSingle = vi.fn();
const mockProfileSingle = vi.fn();
const mockRpc = vi.fn();
const mockUpdateEq = vi.fn();
const mockCancelOrCreditPendingTopup = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "coin_packages") {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: mockPackageSingle }) }) }) };
      }
      if (table === "users") {
        return { select: () => ({ eq: () => ({ single: mockProfileSingle }) }) };
      }
      throw new Error(`Unexpected table in anon client: ${table}`);
    },
  })),
  createServiceClient: vi.fn(() => ({
    rpc: mockRpc,
    from: () => ({
      update: () => ({ eq: mockUpdateEq }),
    }),
  })),
}));

vi.mock("@/lib/coin/cancel-topup", () => ({
  cancelOrCreditPendingTopup: mockCancelOrCreditPendingTopup,
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/coin/topup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const PKG = { id: 1, name: "Starter Pack", coin_amount: 20, price: 15000, is_active: true };

type CreatePendingTopupParams = {
  p_user_id: string;
  p_coin_package_id: number;
  p_package_price: number;
  p_package_coin_amount: number;
  p_payment_reference: string;
  p_voucher_code: string | null;
};

describe("POST /api/coin/topup", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockGetUser.mockReset();
    mockPackageSingle.mockReset();
    mockProfileSingle.mockReset();
    mockRpc.mockReset();
    mockUpdateEq.mockReset();
    mockCancelOrCreditPendingTopup.mockReset();

    process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: "SB-Mid-server-TEST", MIDTRANS_IS_PRODUCTION: "false" };

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null });
    mockPackageSingle.mockResolvedValue({ data: PKG, error: null });
    mockProfileSingle.mockResolvedValue({ data: { name: "User", email: "user@example.com" }, error: null });
    // get_pending_topup_count (rpc pertama) — default 0
    // check_and_record_rate_limit (dipanggil checkRateLimit) — default allowed
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_pending_topup_count") return { data: 0, error: null };
      if (fnName === "check_and_record_rate_limit") return { data: true, error: null };
      return { data: null, error: null };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it("memanggil RPC create_pending_topup SATU KALI untuk membuat transaksi + apply voucher (atomic, Window A)", async () => {
    mockRpc.mockImplementation(async (fnName: string, params: CreatePendingTopupParams) => {
      if (fnName === "get_pending_topup_count") return { data: 0, error: null };
      if (fnName === "check_and_record_rate_limit") return { data: true, error: null };
      if (fnName === "create_pending_topup") {
        expect(params).toEqual(
          expect.objectContaining({
            p_user_id: "user-1",
            p_coin_package_id: 1,
            p_package_price: 15000,
            p_package_coin_amount: 20,
            p_voucher_code: "SALE10",
          })
        );
        return {
          data: {
            success: true,
            transaction: { id: 99, type: "topup", amount: 20, payment_status: "pending", payment_reference: params.p_payment_reference, metadata: null, paid_at: null, created_at: "2025-01-01" },
            discount_amount: 1500,
            final_price: 13500,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ redirect_url: "https://midtrans.example/pay", token: "snap-token-1" }),
    }) as unknown as typeof fetch;

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 1, voucher_code: "sale10" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.discount_amount).toBe(1500);
    expect(json.data.final_price).toBe(13500);
    expect(mockCancelOrCreditPendingTopup).not.toHaveBeenCalled();
  });

  it("jika create_pending_topup balas success:false (misal voucher invalid), return 400 tanpa membuat Snap token", async () => {
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_pending_topup_count") return { data: 0, error: null };
      if (fnName === "check_and_record_rate_limit") return { data: true, error: null };
      if (fnName === "create_pending_topup") {
        return { data: { success: false, message: "Voucher sudah habis digunakan" }, error: null };
      }
      return { data: null, error: null };
    });
    global.fetch = vi.fn();

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 1, voucher_code: "HABIS" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toBe("Voucher sudah habis digunakan");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("(Window B) rollback dipanggil jika Midtrans Snap API balas HTTP error setelah transaksi dibuat", async () => {
    mockRpc.mockImplementation(async (fnName: string, params: CreatePendingTopupParams) => {
      if (fnName === "get_pending_topup_count") return { data: 0, error: null };
      if (fnName === "check_and_record_rate_limit") return { data: true, error: null };
      if (fnName === "create_pending_topup") {
        return {
          data: {
            success: true,
            transaction: { id: 42, type: "topup", amount: 20, payment_status: "pending", payment_reference: params.p_payment_reference, metadata: null, paid_at: null, created_at: "2025-01-01" },
            discount_amount: 0,
            final_price: 15000,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mockCancelOrCreditPendingTopup.mockResolvedValue({ ok: true, outcome: "cancelled", message: "dibatalkan" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    }) as unknown as typeof fetch;

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 1 }));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.success).toBe(false);
    expect(mockCancelOrCreditPendingTopup).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 42, paymentReference: null, userId: "user-1" })
    );
  });

  it("(Window B) rollback dipanggil jika fetch ke Midtrans throw exception (network error)", async () => {
    mockRpc.mockImplementation(async (fnName: string, params: CreatePendingTopupParams) => {
      if (fnName === "get_pending_topup_count") return { data: 0, error: null };
      if (fnName === "check_and_record_rate_limit") return { data: true, error: null };
      if (fnName === "create_pending_topup") {
        return {
          data: {
            success: true,
            transaction: { id: 43, type: "topup", amount: 20, payment_status: "pending", payment_reference: params.p_payment_reference, metadata: null, paid_at: null, created_at: "2025-01-01" },
            discount_amount: 0,
            final_price: 15000,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mockCancelOrCreditPendingTopup.mockResolvedValue({ ok: true, outcome: "cancelled", message: "dibatalkan" });
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 1 }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(mockCancelOrCreditPendingTopup).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 43 })
    );
  });

  it("kegagalan rollback (cancelOrCreditPendingTopup gagal) TIDAK menggagalkan response error ke user", async () => {
    mockRpc.mockImplementation(async (fnName: string, params: CreatePendingTopupParams) => {
      if (fnName === "get_pending_topup_count") return { data: 0, error: null };
      if (fnName === "check_and_record_rate_limit") return { data: true, error: null };
      if (fnName === "create_pending_topup") {
        return {
          data: {
            success: true,
            transaction: { id: 44, type: "topup", amount: 20, payment_status: "pending", payment_reference: params.p_payment_reference, metadata: null, paid_at: null, created_at: "2025-01-01" },
            discount_amount: 0,
            final_price: 15000,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mockCancelOrCreditPendingTopup.mockRejectedValue(new Error("rollback pun gagal"));
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "err" }) as unknown as typeof fetch;

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 1 }));

    // Tetap 502 (bukan crash 500 tak terduga) — rollback exception ditangkap internal.
    expect(res.status).toBe(502);
  });

  it("rate limit 429 jika sudah ada >= 3 transaksi pending, tidak memanggil create_pending_topup", async () => {
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_pending_topup_count") return { data: 3, error: null };
      return { data: null, error: null };
    });

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 1 }));

    expect(res.status).toBe(429);
    expect(mockRpc).not.toHaveBeenCalledWith("create_pending_topup", expect.anything());
  });

  it("mengembalikan 401 jika tidak ada session user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 1 }));

    expect(res.status).toBe(401);
  });

  it("mengembalikan 404 jika paket coin tidak ditemukan", async () => {
    mockPackageSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const { POST } = await import("@/app/api/coin/topup/route");
    const res = await POST(makeRequest({ coin_package_id: 999 }));

    expect(res.status).toBe(404);
  });
});
