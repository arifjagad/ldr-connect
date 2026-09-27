import { describe, it, expect } from "vitest";
import {
  imageDataUrlSchema,
  slotIndexSchema,
  MAX_IMAGE_DATA_URL_LENGTH,
} from "../lib/games/photobooth/action";

describe("Photobooth submit-photo validation", () => {
  it("menerima data URL JPEG hasil canvas.toDataURL", () => {
    expect(imageDataUrlSchema.safeParse("data:image/jpeg;base64,/9j/4AAQSkZJRg==").success).toBe(true);
  });

  it("menolak URL eksternal (tracking pixel)", () => {
    expect(imageDataUrlSchema.safeParse("https://evil.example/x.png").success).toBe(false);
  });

  it("menolak MIME non-gambar dan SVG", () => {
    expect(imageDataUrlSchema.safeParse("data:text/html;base64,PGgxPg==").success).toBe(false);
    expect(imageDataUrlSchema.safeParse("data:image/svg+xml;base64,PHN2Zz4=").success).toBe(false);
  });

  it("menolak payload melebihi batas ukuran", () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_IMAGE_DATA_URL_LENGTH);
    expect(imageDataUrlSchema.safeParse(huge).success).toBe(false);
  });

  it("menolak slot_index 0, negatif, pecahan, dan sampah", () => {
    for (const v of [0, -1, 1.5, 999, "1"]) {
      expect(slotIndexSchema.safeParse(v).success).toBe(false);
    }
    expect(slotIndexSchema.safeParse(3).success).toBe(true);
  });
});
