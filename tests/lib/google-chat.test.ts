import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), people: vi.fn(), request: vi.fn(), jwt: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.user, findMany: m.people } } }));
vi.mock("@/lib/audit", () => ({ auditWrite: m.audit }));
vi.mock("googleapis", () => ({ google: { auth: { JWT: class { constructor(options: unknown) { m.jwt(options); } request = m.request; } } } }));
import { GET, POST } from "@/app/api/google-chat/route";
import { chatAccount } from "@/lib/google-chat/access";
import { ChatError, googleChat, spaceName, threadName } from "@/lib/google-chat/client";
const id = "123e4567-e89b-42d3-a456-426614174000";
const post = (body: unknown, origin = "https://crm.example.test") => new NextRequest("https://crm.example.test/api/google-chat", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_SA_CLIENT_EMAIL = "service@example.invalid";
  process.env.GOOGLE_SA_PRIVATE_KEY = "test-only";
  m.auth.mockResolvedValue({ user: { id: "rep-1", email: "untrusted-session@example.test" } });
  m.user.mockResolvedValue({ id: "rep-1", name: "Rep One", email: "rep1@coastaldebt.com", isActive: true, mustResetPassword: false });
  m.people.mockResolvedValue([{ email: "rep2@coastaldebt.com" }]);
  m.request.mockResolvedValue({ data: {} });
  m.audit.mockResolvedValue(null);
});

describe("Google Chat access", () => {
  it("uses the authenticated user's current database email, never a supplied subject", async () => {
    await GET(new NextRequest("https://crm.example.test/api/google-chat"));
    expect(m.jwt).toHaveBeenCalledWith(expect.objectContaining({ subject: "rep1@coastaldebt.com" }));
    expect(m.user).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "rep-1" } }));
  });
  it.each(["none", "preview", "inactive", "password-reset", "external"])("blocks %s accounts before contacting Google", async kind => {
    if (kind === "none") m.auth.mockResolvedValue(null);
    if (kind === "preview") m.auth.mockResolvedValue({ user: { id: "rep-1" }, impersonation: { adminId: "admin" } });
    if (kind === "inactive") m.user.mockResolvedValue({ id: "rep-1", isActive: false });
    if (kind === "password-reset") m.user.mockResolvedValue({ id: "rep-1", isActive: true, mustResetPassword: true });
    if (kind === "external") m.user.mockResolvedValue({ id: "rep-1", isActive: true, email: "outside@example.org" });
    await expect(chatAccount()).rejects.toBeInstanceOf(ChatError);
    expect(m.request).not.toHaveBeenCalled();
  });
  it("rejects subject overrides on reads", async () => {
    const result = await GET(new NextRequest("https://crm.example.test/api/google-chat?resource=spaces&userId=other"));
    expect(result.status).toBe(400); expect(m.request).not.toHaveBeenCalled();
  });
  it("rejects subject overrides on sends", async () => {
    const result = await POST(post({ action: "send", space: "spaces/AAA", text: "hello", requestId: id, email: "other@coastaldebt.com" }));
    expect(result.status).toBe(400); expect(m.request).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes", async () => {
    expect((await POST(post({ action: "send", space: "spaces/AAA", text: "hello", requestId: id }, "https://attacker.test"))).status).toBe(403);
    expect(m.request).not.toHaveBeenCalled();
  });
});

describe("conversation reads and sends", () => {
  it("paginates messages through Google as the current user with private cache headers", async () => {
    m.request.mockResolvedValue({ data: { messages: [{ name: "spaces/AAA/messages/m1", text: "Hello" }], nextPageToken: "older" } });
    const result = await GET(new NextRequest("https://crm.example.test/api/google-chat?resource=messages&space=spaces%2FAAA&pageToken=next"));
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(m.request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://chat.googleapis.com/v1/spaces/AAA/messages", params: expect.objectContaining({ pageToken: "next", orderBy: "createTime desc", showDeleted: true }) }));
    expect((await result.json()).nextPageToken).toBe("older");
  });
  it("preserves Google's membership denial without leaking upstream data", async () => {
    m.request.mockRejectedValue({ response: { status: 403, data: { error: { message: "private internal details" } } } });
    const result = await GET(new NextRequest("https://crm.example.test/api/google-chat?resource=messages&space=spaces%2FOTHER"));
    expect(result.status).toBe(403); expect(JSON.stringify(await result.json())).not.toContain("private internal details");
  });
  it("sends using a stable request id and never retries POST automatically", async () => {
    m.request.mockResolvedValue({ data: { name: "spaces/AAA/messages/new", text: "Hello" } });
    const result = await POST(post({ action: "send", space: "spaces/AAA", text: " Hello ", requestId: id, thread: "spaces/AAA/threads/t1" }));
    expect(result.status).toBe(200);
    expect(m.request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", retry: false, data: { text: "Hello", thread: { name: "spaces/AAA/threads/t1" } }, params: { requestId: id, messageId: `client-${id}`, messageReplyOption: "REPLY_MESSAGE_OR_FAIL" } }));
    expect(m.jwt).toHaveBeenCalledWith(expect.objectContaining({ scopes: ["https://www.googleapis.com/auth/chat.messages.create"] }));
    expect(JSON.stringify(m.audit.mock.calls)).not.toContain('"Hello"');
  });
  it.each(["", " ", "x".repeat(4001)])("rejects empty or oversized messages", async text => {
    expect((await POST(post({ action: "send", space: "spaces/AAA", text, requestId: id }))).status).toBe(400);
    expect(m.request).not.toHaveBeenCalled();
  });
  it("requires stable ids for retry protection", async () => {
    expect((await POST(post({ action: "send", space: "spaces/AAA", text: "Hi" }))).status).toBe(400);
  });
  it("rejects paths outside the selected space", () => {
    expect(() => spaceName("spaces/AAA/../../users")).toThrow();
    expect(() => threadName("spaces/AAA", "spaces/BBB/threads/t1")).toThrow();
  });
  it("supports the full membership scope when the admin replaced read-only membership access", async () => {
    m.request.mockRejectedValueOnce({ response: { status: 400, data: { error: "unauthorized_client" } } }).mockResolvedValueOnce({ data: { memberships: [] } });
    await googleChat("rep1@coastaldebt.com").members("spaces/AAA");
    expect(m.jwt).toHaveBeenLastCalledWith(expect.objectContaining({ scopes: ["https://www.googleapis.com/auth/chat.memberships"] }));
  });
});

describe("new conversations", () => {
  it("starts a direct message using verified coworker emails", async () => {
    m.request.mockResolvedValue({ data: { name: "spaces/NEW" } });
    expect((await POST(post({ action: "start", userIds: ["rep-2"], requestId: id }))).status).toBe(200);
    expect(m.people).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["rep-2"] }, isActive: true, email: { endsWith: "@coastaldebt.com", mode: "insensitive" } } }));
    expect(m.request).toHaveBeenCalledWith(expect.objectContaining({ data: { requestId: id, space: { spaceType: "DIRECT_MESSAGE" }, memberships: [{ member: { name: "users/rep2@coastaldebt.com", type: "HUMAN" } }] } }));
  });
  it("creates a group conversation when several coworkers are selected", async () => {
    m.people.mockResolvedValue([{ email: "rep2@coastaldebt.com" }, { email: "rep3@coastaldebt.com" }]);
    m.request.mockResolvedValue({ data: { name: "spaces/GROUP" } });
    await POST(post({ action: "start", userIds: ["rep-2", "rep-3"], requestId: id }));
    expect(m.request).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ space: { spaceType: "GROUP_CHAT" } }) }));
  });
  it("rejects disabled or non-workspace recipients", async () => {
    m.people.mockResolvedValue([]);
    expect((await POST(post({ action: "start", userIds: ["external"], requestId: id }))).status).toBe(400);
    expect(m.request).not.toHaveBeenCalled();
  });
  it("rejects selecting yourself", async () => {
    expect((await POST(post({ action: "start", userIds: ["rep-1"], requestId: id }))).status).toBe(400);
    expect(m.request).not.toHaveBeenCalled();
  });
});
