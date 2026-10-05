import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth, updateSession: mocks.update }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { POST } from "@/app/api/admin/user-preview/route";

function request(origin: string, fetchSite?: string) {
  return new NextRequest("https://crm-production-613a.up.railway.app/api/admin/user-preview", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}) },
    body: JSON.stringify({ action: "start", userId: "reader" }),
  });
}

describe("public CRM preview origin", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(null); });
  it("accepts the public CRM origin behind Railway's internal app URL", async () => {
    expect((await POST(request("https://crm.coastaldebt-tools.com"))).status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledOnce();
  });
  it("rejects a foreign origin before reading the session", async () => {
    expect((await POST(request("https://foreign.invalid"))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("accepts a same-origin browser request when its public hostname differs from Railway's URL", async () => {
    expect((await POST(request("https://custom-crm.example.invalid", "same-origin"))).status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledOnce();
  });
  it("still rejects a cross-site browser request", async () => {
    expect((await POST(request("https://foreign.invalid", "cross-site"))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
});
