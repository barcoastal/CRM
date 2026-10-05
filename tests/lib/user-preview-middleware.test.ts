import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { middleware } from "@/middleware";

const secret = "isolated-user-preview-test-secret";
afterEach(() => vi.unstubAllEnvs());
async function request(path: string, method: string, preview = true, secure = false, chunked = false) {
  vi.stubEnv("NEXTAUTH_SECRET", secret);
  const name = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const token = await encode({ secret, salt: name, token: {
    id: "admin", ...(preview ? { viewAs: { userId: "reader", name: "Reader", email: "reader@example.invalid", startedAt: new Date().toISOString() } } : {}),
  } });
  const half = Math.floor(token.length / 2);
  const cookie = chunked ? `${name}.0=${token.slice(0, half)}; ${name}.1=${token.slice(half)}` : `${name}=${token}`;
  return new NextRequest(`https://crm.example.invalid${path}`, { method, headers: { cookie } });
}
describe("encrypted preview session enforcement", () => {
  it.each([[false, false], [true, false], [true, true], [false, true]])("blocks mutation with secure=%s and chunked=%s cookies", async (secure, chunked) => {
    const response = await middleware(await request("/api/accounts", "POST", true, secure, chunked));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("read-only");
  });
  it("blocks server actions as well as API handlers", async () => {
    expect((await middleware(await request("/dashboards/new", "POST"))).status).toBe(403);
  });
  it("leaves normal signed-in requests unchanged", async () => {
    expect((await middleware(await request("/api/accounts", "POST", false))).headers.get("x-middleware-next")).toBe("1");
  });
  it("allows read requests and the separately authorized return endpoint", async () => {
    for (const [path, method] of [["/api/accounts", "GET"], ["/api/admin/user-preview", "POST"]]) {
      expect((await middleware(await request(path, method))).headers.get("x-middleware-next")).toBe("1");
    }
  });
  it("allows a chunked authenticated session to navigate pages", async () => {
    expect((await middleware(await request("/accounts", "GET", true, true, true))).headers.get("x-middleware-next")).toBe("1");
  });
});
