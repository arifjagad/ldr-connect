import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-TESTKEY";
process.env.MIDTRANS_IS_PRODUCTION = "false";

describe("lib/midtrans.ts", () => {
  describe("isPaidStatus / isFailedStatus (pure mapping)", () => {
    it("mengenali settlement sebagai paid", async () => {
      const { isPaidStatus } = await import("@/lib/midtrans");
      expect(isPaidStatus({ transaction_status: "settlement" })).toBe(true);
    });

    it("mengenali capture + fraud accept sebagai paid", async () => {
      const { isPaidStatus } = await import("@/lib/midtrans");
      expect(isPaidStatus({ transaction_status: "capture", fraud_status: "accept" })).toBe(true);
    });

    it("capture + fraud challenge BUKAN paid", async () => {
      const { isPaidStatus } = await import("@/lib/midtrans");
      expect(isPaidStatus({ transaction_status: "capture", fraud_status: "challenge" })).toBe(false);
    });

    it("mengenali deny/cancel/expire sebagai failed", async () => {
      const { isFailedStatus } = await import("@/lib/midtrans");
      expect(isFailedStatus({ transaction_status: "deny" })).toBe(true);
      expect(isFailedStatus({ transaction_status: "cancel" })).toBe(true);
      expect(isFailedStatus({ transaction_status: "expire" })).toBe(true);
      expect(isFailedStatus({ transaction_status: "pending" })).toBe(false);
    });
  });

  describe("cancelTransaction", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("outcome 'cancelled' ketika Midtrans berhasil membatalkan (status_code 200)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status_code: "200", transaction_status: "cancel" }),
      }) as unknown as typeof fetch;

      const { cancelTransaction } = await import("@/lib/midtrans");
      const result = await cancelTransaction("TOPUP-123");

      expect(result.outcome).toBe("cancelled");
    });

    it("outcome 'already_paid' ketika Midtrans balas 412 DAN status aktual settlement — mencegah kredit coin hilang", async () => {
      const fetchMock = vi.fn()
        // Panggilan pertama: POST /cancel → 412 (sudah settled, tidak bisa dibatalkan)
        .mockResolvedValueOnce({
          ok: false,
          status: 412,
          json: async () => ({ status_code: "412", status_message: "Merchant cannot modify the status of the transaction" }),
        })
        // Panggilan kedua: GET /status → cek ulang, ternyata benar sudah settlement
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ transaction_status: "settlement" }),
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { cancelTransaction } = await import("@/lib/midtrans");
      const result = await cancelTransaction("TOPUP-123");

      expect(result.outcome).toBe("already_paid");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("outcome 'not_cancellable' ketika Midtrans balas 412 tapi status aktual bukan paid (misal masih pending/expired)", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 412,
          json: async () => ({ status_code: "412" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ transaction_status: "expire" }),
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { cancelTransaction } = await import("@/lib/midtrans");
      const result = await cancelTransaction("TOPUP-123");

      expect(result.outcome).toBe("not_cancellable");
    });

    it("outcome 'not_cancellable' ketika transaksi tidak ditemukan (404)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ status_code: "404", status_message: "Transaction doesn't exist." }),
      }) as unknown as typeof fetch;

      const { cancelTransaction } = await import("@/lib/midtrans");
      const result = await cancelTransaction("TOPUP-NOTFOUND");

      expect(result.outcome).toBe("not_cancellable");
    });
  });

  describe("cancelSnapSession", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("outcome 'cancelled' ketika Midtrans berhasil membatalkan Snap session (menutup payment page)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ canceled_at: "2025-06-03T13:09:39.776Z" }),
      }) as unknown as typeof fetch;

      const { cancelSnapSession } = await import("@/lib/midtrans");
      const result = await cancelSnapSession("snap-token-abc");

      expect(result.outcome).toBe("cancelled");
    });

    it("outcome 'not_found_or_already_gone' ketika token tidak ditemukan", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error_messages: ["token not found"] }),
      }) as unknown as typeof fetch;

      const { cancelSnapSession } = await import("@/lib/midtrans");
      const result = await cancelSnapSession("snap-token-missing");

      expect(result.outcome).toBe("not_found_or_already_gone");
    });

    it("outcome 'not_found_or_already_gone' ketika token sudah dibatalkan sebelumnya", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_messages: ["token already canceled"] }),
      }) as unknown as typeof fetch;

      const { cancelSnapSession } = await import("@/lib/midtrans");
      const result = await cancelSnapSession("snap-token-already-cancelled");

      expect(result.outcome).toBe("not_found_or_already_gone");
    });

    it("outcome 'in_progress' ketika transaksi sedang diproses (customer sedang charge)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_messages: ["Transaction is on progress"] }),
      }) as unknown as typeof fetch;

      const { cancelSnapSession } = await import("@/lib/midtrans");
      const result = await cancelSnapSession("snap-token-in-progress");

      expect(result.outcome).toBe("in_progress");
    });
  });
});
