import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), contact: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, contact: { findUnique: mocks.contact }, auditLog: { create: mocks.audit } } }));
import { POST } from "../../src/app/api/ssn/[entity]/[id]/route";
const request = () => new NextRequest("https://crm.example/api/ssn/contact/example", { method: "POST", headers: { origin: "https://crm.example" } });
const context = { params: Promise.resolve({ entity: "contact", id: "example" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ session: { userId: "admin" } });
  mocks.user.mockResolvedValue({ role: "ADMIN", isActive: true });
  mocks.contact.mockResolvedValue({ ssn: "000-00-0001" });
  mocks.audit.mockResolvedValue({});
});
describe("admin-only SSN reveal", () => {
  it("rejects unauthenticated access before reading records", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 401 }) });
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.contact).not.toHaveBeenCalled();
  });
  it.each(["MANAGER", "CLOSER", "AGENT"])("rejects direct requests by %s", async role => {
    mocks.user.mockResolvedValue({ role, isActive: true });
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.contact).not.toHaveBeenCalled();
  });
  it("checks the current database role and active flag", async () => {
    mocks.user.mockResolvedValue({ role: "ADMIN", isActive: false });
    expect((await POST(request(), context)).status).toBe(403);
  });
  it("reveals on explicit admin request with no caching and value-free audit", async () => {
    const response = await POST(request(), context);
    expect(await response.json()).toEqual({ ssn: "000-00-0001" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.auth).toHaveBeenCalledWith("Contact.View");
    expect(mocks.audit.mock.calls[0][0].data.action).toBe("REVEAL_SSN");
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("000-00-0001");
  });
  it("accepts same-origin HTTPS requests behind the production HTTP proxy", async () => {
    const req = new NextRequest("http://localhost:8080/api/ssn/contact/example", { method: "POST", headers: { origin: "https://crm.example", host: "crm.example", "x-forwarded-proto": "https" } });
    expect((await POST(req, context)).status).toBe(200);
  });
  it("rejects cross-origin requests", async () => {
    expect((await POST(new NextRequest("https://crm.example/api/ssn/contact/example", { method: "POST", headers: { origin: "https://other.example" } }), context)).status).toBe(403);
    expect(mocks.contact).not.toHaveBeenCalled();
  });
  it("does not disclose values if auditing fails", async () => {
    mocks.audit.mockRejectedValue(new Error("Audit unavailable"));
    await expect(POST(request(), context)).rejects.toThrow("Audit unavailable");
  });
  it("returns not found without revealing anything", async () => {
    mocks.contact.mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(404);
  });
});
