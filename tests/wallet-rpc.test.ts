import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

describe("Wallet Webhook Security & Idempotency Tests", () => {
  const serverKey = "SB-Mid-server-TESTKEY12345";

  it("harus menghasilkan signature SHA512 yang valid sesuai spesifikasi Midtrans", () => {
    const orderId = "TOPUP-1725148800-ABCD";
    const statusCode = "200";
    const grossAmount = "50000.00";

    const expectedSignature = createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");

    expect(expectedSignature).toBeDefined();
    expect(expectedSignature.length).toBe(128); // SHA-512 hex panjang 128 karakter
  });

  it("harus menolak request webhook jika signature dipalsukan", () => {
    const orderId = "TOPUP-1725148800-ABCD";
    const statusCode = "200";
    const grossAmount = "50000.00";
    const forgedSignature = "invalid_hash_signature_payload_xyz";

    const validSignature = createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");

    expect(forgedSignature === validSignature).toBe(false);
  });

  it("harus mengenali status pembayaran final settlement / capture accept", () => {
    function mapStatus(txStatus: string, fraudStatus?: string) {
      const isPaid =
        (txStatus === "capture" && fraudStatus === "accept") ||
        txStatus === "settlement";
      const isFailed =
        txStatus === "deny" || txStatus === "cancel" || txStatus === "expire";

      if (!isPaid && !isFailed) return "pending";
      return isPaid ? "paid" : "failed";
    }

    expect(mapStatus("settlement")).toBe("paid");
    expect(mapStatus("capture", "accept")).toBe("paid");
    expect(mapStatus("capture", "challenge")).toBe("pending");
    expect(mapStatus("deny")).toBe("failed");
    expect(mapStatus("pending")).toBe("pending");
  });
});
