import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test untuk lib/coin/cancel-topup.ts (closeMidtransAccessForTopup) — logic
 * inti yang dipakai bersama oleh POST /api/coin/cancel-topup (user manual)
 * dan GET /api/cron/expire-topup (auto-expire). Fokus pada:
 * 1. Snap session ditutup SEBELUM Core API cancel.
 * 2. Race condition (Snap 'in_progress' / Core 'already_paid') dikreditkan
 *    sebagai sukses, bukan digagalkan.
 */

const mockCancelSnapSession = vi.fn();
const mockCancelTransaction = vi.fn();
const mockGetTransactionStatus = vi.fn();
const mockCreditFromKnownStatus = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/midtrans", () => ({
  cancelSnapSession: mockCancelSnapSession,
  cancelTransaction: mockCancelTransaction,
  getTransactionStatus: mockGetTransactionStatus,
}));

vi.mock("@/lib/coin/verify-payment", () => ({
  creditFromKnownStatus: mockCreditFromKnownStatus,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

describe("closeMidtransAccessForTopup", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCancelSnapSession.mockReset();
    mockCancelTransaction.mockReset();
    mockGetTransactionStatus.mockReset();
    mockCreditFromKnownStatus.mockReset();
    mockCancelTransaction.mockResolvedValue({ outcome: "cancelled", data: {} });
  });

  it("menutup Snap session SEBELUM memanggil Core API cancelTransaction", async () => {
    mockCancelSnapSession.mockResolvedValue({ outcome: "cancelled" });

    const { closeMidtransAccessForTopup } = await import("@/lib/coin/cancel-topup");
    const result = await closeMidtransAccessForTopup({
      paymentReference: "TOPUP-1",
      userId: "user-1",
      snapToken: "snap-token-1",
    });

    expect(mockCancelSnapSession).toHaveBeenCalledWith("snap-token-1");
    expect(mockCancelTransaction).toHaveBeenCalledWith("TOPUP-1");
    expect(result.outcome).toBe("safe_to_finalize_as_failed");
  });

  it("melewati cancelSnapSession jika snapToken tidak diberikan", async () => {
    const { closeMidtransAccessForTopup } = await import("@/lib/coin/cancel-topup");
    const result = await closeMidtransAccessForTopup({
      paymentReference: "TOPUP-2",
      userId: "user-1",
      snapToken: null,
    });

    expect(mockCancelSnapSession).not.toHaveBeenCalled();
    expect(mockCancelTransaction).toHaveBeenCalledWith("TOPUP-2");
    expect(result.outcome).toBe("safe_to_finalize_as_failed");
  });

  it("race condition Snap 'in_progress': kredit sebagai SUKSES, TIDAK memanggil Core cancelTransaction", async () => {
    mockCancelSnapSession.mockResolvedValue({ outcome: "in_progress" });
    mockGetTransactionStatus.mockResolvedValue({ transaction_status: "settlement" });
    mockCreditFromKnownStatus.mockResolvedValue({
      ok: true, status: "paid", alreadyProcessed: false, transaction: { id: 1 },
    });

    const { closeMidtransAccessForTopup } = await import("@/lib/coin/cancel-topup");
    const result = await closeMidtransAccessForTopup({
      paymentReference: "TOPUP-3",
      userId: "user-1",
      snapToken: "snap-token-3",
    });

    expect(mockCancelTransaction).not.toHaveBeenCalled();
    expect(mockCreditFromKnownStatus).toHaveBeenCalledWith(
      expect.objectContaining({ paymentReference: "TOPUP-3", userId: "user-1" })
    );
    expect(result.outcome).toBe("credited_as_paid");
  });

  it("race condition Core 'already_paid': kredit sebagai SUKSES bukan digagalkan", async () => {
    mockCancelSnapSession.mockResolvedValue({ outcome: "not_found_or_already_gone" });
    mockCancelTransaction.mockResolvedValue({ outcome: "already_paid", data: { transaction_status: "settlement" } });
    mockGetTransactionStatus.mockResolvedValue({ transaction_status: "settlement" });
    mockCreditFromKnownStatus.mockResolvedValue({
      ok: true, status: "paid", alreadyProcessed: false, transaction: { id: 1 },
    });

    const { closeMidtransAccessForTopup } = await import("@/lib/coin/cancel-topup");
    const result = await closeMidtransAccessForTopup({
      paymentReference: "TOPUP-4",
      userId: "user-1",
      snapToken: "snap-token-4",
    });

    expect(result.outcome).toBe("credited_as_paid");
  });

  it("outcome 'credit_failed' jika creditFromKnownStatus gagal setelah terdeteksi sudah bayar", async () => {
    mockCancelSnapSession.mockResolvedValue({ outcome: "in_progress" });
    mockGetTransactionStatus.mockResolvedValue({ transaction_status: "settlement" });
    mockCreditFromKnownStatus.mockResolvedValue({
      ok: false, code: "RPC_ERROR", message: "DB error",
    });

    const { closeMidtransAccessForTopup } = await import("@/lib/coin/cancel-topup");
    const result = await closeMidtransAccessForTopup({
      paymentReference: "TOPUP-5",
      userId: "user-1",
      snapToken: "snap-token-5",
    });

    expect(result.outcome).toBe("credit_failed");
    if (result.outcome === "credit_failed") {
      expect(result.message).toBe("DB error");
    }
  });

  it("outcome not_cancellable (misal sudah expired di Midtrans) tetap aman difinalisasi sebagai failed", async () => {
    mockCancelSnapSession.mockResolvedValue({ outcome: "not_found_or_already_gone" });
    mockCancelTransaction.mockResolvedValue({ outcome: "not_cancellable", data: null });

    const { closeMidtransAccessForTopup } = await import("@/lib/coin/cancel-topup");
    const result = await closeMidtransAccessForTopup({
      paymentReference: "TOPUP-6",
      userId: "user-1",
      snapToken: "snap-token-6",
    });

    expect(result.outcome).toBe("safe_to_finalize_as_failed");
  });
});

describe("cancelOrCreditPendingTopup", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCancelSnapSession.mockReset();
    mockCancelTransaction.mockReset();
    mockGetTransactionStatus.mockReset();
    mockCreditFromKnownStatus.mockReset();
    mockRpc.mockReset();
    mockCancelTransaction.mockResolvedValue({ outcome: "cancelled", data: {} });
    mockCancelSnapSession.mockResolvedValue({ outcome: "cancelled" });
  });

  it("memanggil RPC cancel_topup_transaction setelah Midtrans aman ditutup, return outcome 'cancelled'", async () => {
    mockRpc.mockResolvedValue({ data: { success: true, message: "Transaksi top up berhasil dibatalkan" }, error: null });

    const { cancelOrCreditPendingTopup } = await import("@/lib/coin/cancel-topup");
    const result = await cancelOrCreditPendingTopup({
      transactionId: 1,
      paymentReference: "TOPUP-1",
      userId: "user-1",
      snapToken: "snap-token-1",
    });

    expect(mockRpc).toHaveBeenCalledWith("cancel_topup_transaction", {
      p_transaction_id: 1,
      p_user_id: "user-1",
    });
    expect(result).toEqual({ ok: true, outcome: "cancelled", message: "Transaksi top up berhasil dibatalkan" });
  });

  it("race condition: TIDAK memanggil RPC cancel_topup_transaction jika ternyata sudah dibayar", async () => {
    mockCancelSnapSession.mockResolvedValue({ outcome: "in_progress" });
    mockGetTransactionStatus.mockResolvedValue({ transaction_status: "settlement" });
    mockCreditFromKnownStatus.mockResolvedValue({
      ok: true, status: "paid", alreadyProcessed: false, transaction: { id: 1 },
    });

    const { cancelOrCreditPendingTopup } = await import("@/lib/coin/cancel-topup");
    const result = await cancelOrCreditPendingTopup({
      transactionId: 2,
      paymentReference: "TOPUP-2",
      userId: "user-1",
      snapToken: "snap-token-2",
    });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, outcome: "credited_as_paid" });
  });

  it("skip closeMidtransAccessForTopup sama sekali jika paymentReference null (transaksi tanpa referensi Midtrans)", async () => {
    mockRpc.mockResolvedValue({ data: { success: true, message: "Transaksi top up berhasil dibatalkan" }, error: null });

    const { cancelOrCreditPendingTopup } = await import("@/lib/coin/cancel-topup");
    const result = await cancelOrCreditPendingTopup({
      transactionId: 3,
      paymentReference: null,
      userId: "user-1",
    });

    expect(mockCancelSnapSession).not.toHaveBeenCalled();
    expect(mockCancelTransaction).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("reason 'system_error' jika RPC error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection timeout" } });

    const { cancelOrCreditPendingTopup } = await import("@/lib/coin/cancel-topup");
    const result = await cancelOrCreditPendingTopup({
      transactionId: 4,
      paymentReference: "TOPUP-4",
      userId: "user-1",
      snapToken: "snap-token-4",
    });

    expect(result).toEqual({ ok: false, reason: "system_error", message: "connection timeout" });
  });

  it("reason 'business_error' jika RPC balas success:false (misal status sudah berubah)", async () => {
    mockRpc.mockResolvedValue({ data: { success: false, message: "Transaksi sudah tidak dalam status menunggu pembayaran" }, error: null });

    const { cancelOrCreditPendingTopup } = await import("@/lib/coin/cancel-topup");
    const result = await cancelOrCreditPendingTopup({
      transactionId: 5,
      paymentReference: "TOPUP-5",
      userId: "user-1",
      snapToken: "snap-token-5",
    });

    expect(result).toEqual({ ok: false, reason: "business_error", message: "Transaksi sudah tidak dalam status menunggu pembayaran" });
  });
});
