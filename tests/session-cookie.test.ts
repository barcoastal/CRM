import { describe, expect, it } from "vitest";
import { hasCrmSessionCookie } from "@/lib/session-cookie";

describe("CRM and Five9 session selection", () => {
  it("prefers the regular session when both cookies are present", () => {
    expect(hasCrmSessionCookie(["__Secure-crm.five9-session", "__Secure-authjs.session-token"])).toBe(true);
  });

  it("recognizes a chunked regular session", () => {
    expect(hasCrmSessionCookie(["authjs.session-token.0", "authjs.session-token.1"])).toBe(true);
  });

  it("allows a frame-only session without a regular cookie", () => {
    expect(hasCrmSessionCookie(["__Secure-crm.five9-session"])).toBe(false);
  });
});
