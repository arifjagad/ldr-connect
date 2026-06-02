import { randomBytes } from "crypto";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CHARSET_LEN = CHARSET.length;

/**
 * Generate session code 12-karakter menggunakan CSPRNG (crypto.randomBytes).
 * Lebih aman dari Math.random() karena tidak bisa diprediksi.
 * Digunakan sebagai: session_code di game_sessions + nama room Daily.co.
 *
 * Teknik: rejection sampling — hanya gunakan byte yang berada dalam range
 * kelipatan CHARSET_LEN agar distribusi tetap uniform tanpa modulo bias.
 */
export function generateSessionCode(length = 12): string {
  const result: string[] = [];
  const limit = 256 - (256 % CHARSET_LEN); // 252 untuk charset 36 karakter

  while (result.length < length) {
    const buf = randomBytes(length * 2); // over-sample agar jarang perlu loop ulang
    for (let i = 0; i < buf.length && result.length < length; i++) {
      if (buf[i] < limit) {
        result.push(CHARSET[buf[i] % CHARSET_LEN]);
      }
    }
  }

  return result.join("");
}

/**
 * Fisher-Yates shuffle berbasis CSPRNG.
 * Digunakan untuk mengacak urutan array (pertanyaan, board squares, dll.)
 * tanpa bias dari Math.random().
 */
export function cryptoShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    // Ambil 4 byte (uint32) → uniform random di [0, i]
    const j = Number(randomBytes(4).readUInt32BE(0) % (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Random integer [min, max] inklusif menggunakan CSPRNG.
 */
export function cryptoRandInt(min: number, max: number): number {
  const range = max - min + 1;
  const limit = Math.floor(0x100000000 / range) * range;
  let r: number;
  do {
    r = randomBytes(4).readUInt32BE(0);
  } while (r >= limit);
  return min + (r % range);
}
