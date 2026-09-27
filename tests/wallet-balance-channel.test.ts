import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Verifikasi bahwa wallet-balance-channel.ts mencegah bug:
 * "cannot add `postgres_changes` callbacks ... after `subscribe()`"
 * yang terjadi jika dua pemanggil membuat channel Supabase dengan nama
 * sama di atas client singleton yang sama.
 */

type OnHandler = (payload: unknown) => void;

function createMockChannelFactory() {
  const createdChannelNames: string[] = [];
  const onCalls: { channelName: string }[] = [];
  const subscribedChannelNames = new Set<string>();
  type MockChannel = {
    on: (event: string, filter: unknown, handler: OnHandler) => MockChannel;
    subscribe: () => MockChannel;
  };
  const channelInstances = new Map<string, MockChannel>();
  const handlersByName = new Map<string, OnHandler>();

  function channel(name: string) {
    // Simulasikan perilaku nyata Supabase: memanggil .channel() dengan nama
    // yang sama pada client yang sama mengembalikan OBJEK YANG SAMA.
    if (channelInstances.has(name)) {
      return channelInstances.get(name);
    }
    createdChannelNames.push(name);

    const instance: MockChannel = {
      on(_event: string, _filter: unknown, handler: OnHandler) {
        if (subscribedChannelNames.has(name)) {
          throw new Error(
            `cannot add \`postgres_changes\` callbacks for realtime:${name} after \`subscribe()\`.`
          );
        }
        onCalls.push({ channelName: name });
        handlersByName.set(name, handler);
        return instance;
      },
      subscribe() {
        subscribedChannelNames.add(name);
        return instance;
      },
    };
    channelInstances.set(name, instance);
    return instance;
  }

  function removeChannel(ch: unknown) {
    // Simulasikan removeChannel Supabase asli: channel benar-benar dibuang
    // dari registry sehingga .channel(sameName) berikutnya membuat instance baru.
    for (const [name, instance] of channelInstances.entries()) {
      if (instance === ch) {
        channelInstances.delete(name);
        subscribedChannelNames.delete(name);
        handlersByName.delete(name);
        break;
      }
    }
  }

  function reset() {
    createdChannelNames.length = 0;
    onCalls.length = 0;
    subscribedChannelNames.clear();
    channelInstances.clear();
    handlersByName.clear();
  }

  return {
    channel,
    removeChannel,
    createdChannelNames,
    onCalls,
    reset,
    emit: (name: string, payload: unknown) => handlersByName.get(name)?.(payload),
  };
}

const mockClient = createMockChannelFactory();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

describe("subscribeWalletBalance (lib/realtime/wallet-balance-channel.ts)", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockClient.reset();
    const mod = await import("@/lib/realtime/wallet-balance-channel");
    mod.__resetWalletBalanceChannelsForTest();
  });

  it("hanya membuat SATU channel Supabase walau dipanggil dua kali untuk userId yang sama (simulasi navbar + halaman coin)", async () => {
    const { subscribeWalletBalance } = await import("@/lib/realtime/wallet-balance-channel");

    const listenerA = vi.fn();
    const listenerB = vi.fn();

    // Simulasi: AppShell (navbar) subscribe duluan
    const unsubA = subscribeWalletBalance("user-1", listenerA);
    // Simulasi: CoinPage subscribe setelahnya, channel SUDAH ter-subscribe()
    // Ini adalah skenario yang sebelumnya menyebabkan crash.
    expect(() => subscribeWalletBalance("user-1", listenerB)).not.toThrow();

    expect(mockClient.createdChannelNames).toEqual(["wallet-balance-user-1"]);
    expect(mockClient.onCalls).toHaveLength(1); // .on() cuma dipanggil sekali

    unsubA();
  });

  it("membroadcast event balance ke SEMUA listener yang subscribe pada userId yang sama", async () => {
    const { subscribeWalletBalance } = await import("@/lib/realtime/wallet-balance-channel");

    const listenerA = vi.fn();
    const listenerB = vi.fn();

    subscribeWalletBalance("user-1", listenerA);
    subscribeWalletBalance("user-1", listenerB);

    mockClient.emit("wallet-balance-user-1", { new: { balance: 250 } });

    expect(listenerA).toHaveBeenCalledWith(250);
    expect(listenerB).toHaveBeenCalledWith(250);
  });

  it("channel dibuat ulang (nama sama) jika semua listener sebelumnya unsubscribe lalu subscribe baru masuk", async () => {
    const { subscribeWalletBalance } = await import("@/lib/realtime/wallet-balance-channel");

    const listenerA = vi.fn();
    const unsubA = subscribeWalletBalance("user-2", listenerA);
    unsubA(); // listener terakhir keluar → channel di-remove dari registry

    const listenerB = vi.fn();
    expect(() => subscribeWalletBalance("user-2", listenerB)).not.toThrow();

    // Channel lama sudah di-removeChannel() saat listener terakhir keluar,
    // jadi channel baru (instance baru) dibuat lagi untuk listener berikutnya.
    expect(mockClient.createdChannelNames).toEqual([
      "wallet-balance-user-2",
      "wallet-balance-user-2",
    ]);
  });

  it("channel terpisah untuk userId yang berbeda", async () => {
    const { subscribeWalletBalance } = await import("@/lib/realtime/wallet-balance-channel");

    subscribeWalletBalance("user-a", vi.fn());
    subscribeWalletBalance("user-b", vi.fn());

    expect(mockClient.createdChannelNames).toEqual([
      "wallet-balance-user-a",
      "wallet-balance-user-b",
    ]);
  });
});
