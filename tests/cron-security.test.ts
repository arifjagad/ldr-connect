import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as capsuleCronHandler } from "@/app/api/cron/capsule-delivery/route";
import { GET as anniversaryCronHandler } from "@/app/api/cron/anniversary-reminders/route";

describe("Cron Security Authorization Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("Capsule Delivery: harus tolak 401 saat tidak ada Authorization header", async () => {
    process.env.CRON_SECRET = "super_secret_cron_token";
    const req = new NextRequest("http://localhost:3000/api/cron/capsule-delivery");
    const res = await capsuleCronHandler(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("Capsule Delivery: harus tolak 401 saat token Authorization salah", async () => {
    process.env.CRON_SECRET = "super_secret_cron_token";
    const req = new NextRequest("http://localhost:3000/api/cron/capsule-delivery", {
      headers: { authorization: "Bearer wrong_token" },
    });
    const res = await capsuleCronHandler(req);
    expect(res.status).toBe(401);
  });

  it("Capsule Delivery: harus tetap tolak 401 (fail-closed) saat CRON_SECRET di server kosong", async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest("http://localhost:3000/api/cron/capsule-delivery", {
      headers: { authorization: "Bearer any_token" },
    });
    const res = await capsuleCronHandler(req);
    expect(res.status).toBe(401);
  });

  it("Anniversary Reminder: harus tolak 401 saat CRON_SECRET kosong atau authorization salah", async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest("http://localhost:3000/api/cron/anniversary-reminders");
    const res = await anniversaryCronHandler(req);
    expect(res.status).toBe(401);
  });
});
