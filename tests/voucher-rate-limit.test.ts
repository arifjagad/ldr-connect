import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Test untuk rate limiting di GET /api/coin/check-voucher dan
 * GET /api/coin/validate-voucher — kedua endpoint read-only ini sebelumnya
 * tidak dibatasi rate limit sama sekali, sehingga rentan dipakai untuk
 * enumerasi/brute-force kode voucher aktif (terutama voucher promo
 * berkuota terbatas). Sekarang keduanya pakai checkRateLimit() yang sama
 * dengan redeem-voucher.
 */

const mockGetUser = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockVoucherSingle = vi.fn();
const mockRedemptionMaybeSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "vouchers") {
        return {
          select: () => ({
            eq: () => ({ single: mockVoucherSingle }),
          }),
        };
      }
      if (table === "voucher_redemptions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: mockRedemptionMaybeSingle }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

function makeRequest(url: string) {
  return new NextRequest(url);
}

describe("Rate limiting untuk endpoint voucher read-only", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetUser.mockReset();
    mockCheckRateLimit.mockReset();
    mockVoucherSingle.mockReset();
    mockRedemptionMaybeSingle.mockReset();
    mockRpc.mockReset();

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  describe("GET /api/coin/check-voucher", () => {
    it("memanggil checkRateLimit dengan endpoint 'coin/check-voucher' sebelum query voucher", async () => {
      mockCheckRateLimit.mockResolvedValue(null); // allowed
      mockVoucherSingle.mockResolvedValue({ data: null, error: null });

      const { GET } = await import("@/app/api/coin/check-voucher/route");
      await GET(makeRequest("http://localhost:3000/api/coin/check-voucher?code=SALE10"));

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ endpoint: "coin/check-voucher" })
      );
    });

    it("mengembalikan 429 dan TIDAK query voucher jika rate limit terlampaui", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ success: false, message: "Terlalu banyak permintaan", data: null }),
        { status: 429 }
      );
      mockCheckRateLimit.mockResolvedValue(rateLimitResponse);

      const { GET } = await import("@/app/api/coin/check-voucher/route");
      const res = await GET(makeRequest("http://localhost:3000/api/coin/check-voucher?code=SALE10"));

      expect(res.status).toBe(429);
      expect(mockVoucherSingle).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/coin/validate-voucher", () => {
    it("memanggil checkRateLimit dengan endpoint 'coin/validate-voucher' sebelum panggil RPC", async () => {
      mockCheckRateLimit.mockResolvedValue(null); // allowed
      mockRpc.mockResolvedValue({ data: { success: false, message: "Voucher tidak ditemukan" }, error: null });

      const { GET } = await import("@/app/api/coin/validate-voucher/route");
      await GET(makeRequest("http://localhost:3000/api/coin/validate-voucher?code=SALE10&amount=15000"));

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ endpoint: "coin/validate-voucher" })
      );
    });

    it("mengembalikan 429 dan TIDAK memanggil RPC jika rate limit terlampaui", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ success: false, message: "Terlalu banyak permintaan", data: null }),
        { status: 429 }
      );
      mockCheckRateLimit.mockResolvedValue(rateLimitResponse);

      const { GET } = await import("@/app/api/coin/validate-voucher/route");
      const res = await GET(makeRequest("http://localhost:3000/api/coin/validate-voucher?code=SALE10&amount=15000"));

      expect(res.status).toBe(429);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
