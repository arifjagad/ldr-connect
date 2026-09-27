/**
 * Helper terpusat untuk komunikasi dengan Midtrans Core API & Snap API
 * (status, cancel transaksi, cancel Snap session).
 * Dipakai oleh: app/api/coin/verify, app/api/coin/cancel-topup, app/api/coin/webhook (status mapping).
 *
 * Dokumentasi:
 * - Get Status:            https://docs.midtrans.com/reference/get-transaction-status
 * - Cancel Transaction:    https://docs.midtrans.com/reference/cancel-transaction
 * - Cancel a Snap Session: https://docs.midtrans.com/reference/cancel-a-snap-session
 */

const MIDTRANS_CORE_API_URL = process.env.MIDTRANS_IS_PRODUCTION === "true"
  ? "https://api.midtrans.com/v2"
  : "https://api.sandbox.midtrans.com/v2";

const MIDTRANS_SNAP_API_URL = process.env.MIDTRANS_IS_PRODUCTION === "true"
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

function authHeader(): string {
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  return "Basic " + Buffer.from(serverKey + ":").toString("base64");
}

export type MidtransStatusData = {
  transaction_status?: string;
  fraud_status?: string;
  settlement_time?: string;
  status_code?: string;
  [key: string]: unknown;
};

/**
 * GET /v2/{order_id}/status — cek status transaksi terkini di Midtrans.
 * Return `null` jika transaksi tidak ditemukan (404) atau order_id invalid.
 */
export async function getTransactionStatus(orderId: string): Promise<MidtransStatusData | null> {
  const res = await fetch(
    `${MIDTRANS_CORE_API_URL}/${encodeURIComponent(orderId)}/status`,
    { headers: { Authorization: authHeader() } }
  );
  if (!res.ok) return null;
  return (await res.json()) as MidtransStatusData;
}

export type MidtransCancelResult =
  | { outcome: "cancelled"; data: MidtransStatusData }
  /** Midtrans menolak cancel karena transaksi sudah settled/capture-accept — anggap sudah dibayar */
  | { outcome: "already_paid"; data: MidtransStatusData | null }
  /** Transaksi memang tidak ditemukan / sudah dalam status final lain (expire/deny/cancel) */
  | { outcome: "not_cancellable"; data: MidtransStatusData | null };

/**
 * POST /v2/{order_id}/cancel — batalkan transaksi di sisi Midtrans supaya
 * Snap payment page tidak bisa lagi dipakai untuk membayar.
 *
 * Midtrans balas HTTP 412 "Merchant cannot modify the status of the transaction"
 * jika transaksi sudah settlement/capture — ini KASUS PENTING: berarti user
 * sudah terlanjur bayar tepat sebelum cancel diproses. Dalam kasus ini kita
 * TIDAK boleh menganggapnya sebagai "berhasil dibatalkan" — harus dicek ulang
 * status aktualnya dan diproses sebagai pembayaran sukses (kredit coin).
 */
export async function cancelTransaction(orderId: string): Promise<MidtransCancelResult> {
  const res = await fetch(
    `${MIDTRANS_CORE_API_URL}/${encodeURIComponent(orderId)}/cancel`,
    { method: "POST", headers: { Authorization: authHeader() } }
  );

  const json = (await res.json().catch(() => ({}))) as MidtransStatusData & {
    status_code?: string;
    status_message?: string;
  };

  if (res.ok && (json.status_code === "200" || json.transaction_status === "cancel")) {
    return { outcome: "cancelled", data: json };
  }

  // Midtrans balas 412 ketika transaksi sudah di-capture/settle dan tidak bisa
  // lagi dibatalkan — perlu verifikasi ulang status aktual via getTransactionStatus.
  if (res.status === 412 || json.status_code === "412") {
    const latest = await getTransactionStatus(orderId);
    if (latest && isPaidStatus(latest)) {
      return { outcome: "already_paid", data: latest };
    }
    return { outcome: "not_cancellable", data: latest };
  }

  // 404 atau status lain (sudah expired/deny di sisi Midtrans) — tidak perlu
  // dibatalkan lagi, transaksi memang sudah tidak bisa dibayar.
  return { outcome: "not_cancellable", data: json.status_code ? json : null };
}

export type CancelSnapSessionResult =
  | { outcome: "cancelled" }
  /** Token tidak ditemukan / sudah dibatalkan sebelumnya / sudah expired — aman diabaikan */
  | { outcome: "not_found_or_already_gone" }
  /** Midtrans menolak karena transaksi sedang "on progress" (misal user baru pilih metode bayar & di tengah proses charge) */
  | { outcome: "in_progress" };

/**
 * POST /snap/v1/transactions/{snap_token}/cancel — tutup Snap PAGE SESSION.
 *
 * ⚠️ PENTING: ini BEDA dari cancelTransaction() (Core API, /v2/{order_id}/cancel).
 * Snap page punya session sendiri yang terpisah dari transaksi Core API:
 * - Selama customer belum memilih metode pembayaran di Snap page, BELUM ADA
 *   transaksi apapun di Core API (GET/POST /v2/{order_id}/... akan balas
 *   "transaction doesn't exist") — TAPI Snap page-nya sendiri tetap valid
 *   dan bisa terus diakses/dibayar sampai page_expiry (default 24 jam).
 * - Makanya membatalkan lewat Core API cancelTransaction() saja TIDAK
 *   cukup untuk menutup akses ke Snap payment page. Endpoint ini yang
 *   benar-benar menutupnya: setelah dipanggil, jika customer masih berada
 *   di Snap page dan mencoba lanjut bayar, Midtrans akan menampilkan error
 *   "tidak dapat melanjutkan transaksi".
 */
export async function cancelSnapSession(snapToken: string): Promise<CancelSnapSessionResult> {
  const res = await fetch(
    `${MIDTRANS_SNAP_API_URL}/${encodeURIComponent(snapToken)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (res.ok) {
    return { outcome: "cancelled" };
  }

  const json = (await res.json().catch(() => ({}))) as { error_messages?: string[] };
  const messages = (json.error_messages ?? []).join(" ").toLowerCase();

  if (messages.includes("on progress")) {
    return { outcome: "in_progress" };
  }
  // "token not found" | "token already canceled" | expired | 404, dll —
  // semuanya aman diperlakukan sebagai "sudah tidak bisa diakses lagi".
  return { outcome: "not_found_or_already_gone" };
}

/** Sama persis dengan mapping status di webhook & verify — satu sumber kebenaran. */
export function isPaidStatus(data: Pick<MidtransStatusData, "transaction_status" | "fraud_status">): boolean {
  return (
    (data.transaction_status === "capture" && data.fraud_status === "accept") ||
    data.transaction_status === "settlement"
  );
}

export function isFailedStatus(data: Pick<MidtransStatusData, "transaction_status">): boolean {
  return (
    data.transaction_status === "deny" ||
    data.transaction_status === "cancel" ||
    data.transaction_status === "expire"
  );
}
