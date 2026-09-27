import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/ssr agar createBrowserClient bisa dihitung berapa kali dipanggil
// dan mengembalikan objek baru setiap kali dipanggil (simulasi constructor asli)
const createBrowserClientMock = vi.fn((...args: unknown[]) => {
  void args;
  return { __marker: Symbol("supabase-client-instance") };
});

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClientMock(...args),
}));

describe("Supabase browser client singleton (lib/supabase/client.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserClientMock.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("mengembalikan referensi objek yang sama pada pemanggilan berulang", async () => {
    const { createClient } = await import("@/lib/supabase/client");

    const first = createClient();
    const second = createClient();
    const third = createClient();

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("hanya membuat instance createBrowserClient satu kali walau createClient() dipanggil berkali-kali", async () => {
    const { createClient } = await import("@/lib/supabase/client");

    createClient();
    createClient();
    createClient();

    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
  });

  it("meneruskan URL dan anon key dari env variable ke createBrowserClient", async () => {
    const { createClient } = await import("@/lib/supabase/client");

    createClient();

    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-anon-key"
    );
  });

  it("instance baru dibuat lagi jika module di-reset (memastikan mock bekerja sesuai ekspektasi, bukan cache lintas-test)", async () => {
    const mod1 = await import("@/lib/supabase/client");
    mod1.createClient();

    vi.resetModules();
    createBrowserClientMock.mockClear();

    const mod2 = await import("@/lib/supabase/client");
    mod2.createClient();

    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
  });
});
