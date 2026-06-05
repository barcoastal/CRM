import { describe, it, expect } from "vitest";
import {
  parseSetCookies,
  cookieHeaderFor,
  mergeCookies,
} from "../../src/lib/five9/agent-api";

/**
 * Regression for the "User is not logged in" 401: /auth/login on app.five9.com
 * sets session cookies (Domain=five9.com) plus host-only F5 cookies
 * (BIGipServer…, TS…) scoped to app.five9.com. Replaying the host-only cookies
 * to the data-center host (app-atl.five9.com) misroutes the request. The jar
 * must send the Domain cookies and DROP the host-only ones to app-atl.
 */

// Exactly what Bar's tenant returned from /auth/login (Set-Cookie).
function fakeResponse(setCookies: string[]): Response {
  return {
    headers: {
      getSetCookie: () => setCookies,
      get: () => null,
    },
  } as unknown as Response;
}

const LOGIN_SET_COOKIES = [
  "apiRouteKey=ATLyAPId16; Domain=five9.com; Path=/",
  "uiRouteKey=ATLyUIb756; Domain=five9.com; Path=/",
  "farmId=252; Domain=five9.com; Path=/",
  "Authorization=tok-abc; Domain=five9.com; Path=/",
  "f9-sessionId=sess-xyz; Domain=five9.com; Path=/",
  "app_key=appk; Domain=five9.com; Path=/",
  "BIGipServer~VCC-WEB-INFRASTRUCTURE~defaultV10APIPool=node1; Path=/",
  "TS01582219=ts-a; Path=/",
  "TS01f44108=ts-b; Domain=five9.com; Path=/",
];

describe("five9 cookie jar", () => {
  const jar = parseSetCookies(fakeResponse(LOGIN_SET_COOKIES), "app.five9.com");

  it("parses domain and host-only scoping correctly", () => {
    const apiRouteKey = jar.find((c) => c.name === "apiRouteKey");
    expect(apiRouteKey?.domain).toBe("five9.com");
    const bigip = jar.find((c) => c.name.startsWith("BIGipServer"));
    expect(bigip?.domain).toBeNull();
    expect(bigip?.host).toBe("app.five9.com");
  });

  it("sends session cookies to the data-center host", () => {
    const header = cookieHeaderFor(jar, "app-atl.five9.com");
    expect(header).toContain("apiRouteKey=ATLyAPId16");
    expect(header).toContain("Authorization=tok-abc");
    expect(header).toContain("f9-sessionId=sess-xyz");
    expect(header).toContain("farmId=252");
    expect(header).toContain("TS01f44108=ts-b"); // Domain=five9.com → still sent
  });

  it("DROPS app.five9.com host-only cookies when calling app-atl", () => {
    const header = cookieHeaderFor(jar, "app-atl.five9.com");
    expect(header).not.toContain("BIGipServer");
    expect(header).not.toContain("TS01582219");
  });

  it("still sends host-only cookies back to the host that set them", () => {
    const header = cookieHeaderFor(jar, "app.five9.com");
    expect(header).toContain("BIGipServer~VCC-WEB-INFRASTRUCTURE~defaultV10APIPool=node1");
    expect(header).toContain("TS01582219=ts-a");
  });

  it("merges data-center cookies and prefers them on the next call", () => {
    // app-atl sets its OWN affinity cookie on the login_state response.
    const dcCookies = parseSetCookies(
      fakeResponse(["BIGipServer~VCC~atlPool=atlnode; Path=/"]),
      "app-atl.five9.com",
    );
    const merged = mergeCookies(jar, dcCookies);
    const header = cookieHeaderFor(merged, "app-atl.five9.com");
    expect(header).toContain("BIGipServer~VCC~atlPool=atlnode"); // app-atl's own affinity carried forward
    expect(header).not.toContain("defaultV10APIPool"); // app.five9.com's still excluded
  });
});
