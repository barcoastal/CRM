import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ eligible: vi.fn(), read: vi.fn(), source: vi.fn(), auth: vi.fn(), access: vi.fn(), user: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/negotiation-access", () => ({ isNegotiationEligible: mocks.eligible }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { emailMessage: { findUnique: mocks.source }, user: { findUnique: mocks.user } } }));
vi.mock("@/lib/google/gmail-client", () => ({ gmailConfigured: () => true, makeGmailWriteClient: () => ({ sendRaw: vi.fn() }) }));
vi.mock("@/lib/google/gmail-send", () => ({ sendGmail: mocks.send }));
vi.mock("@/lib/email-sender", () => ({ generateMessageId: vi.fn() }));
vi.mock("@/lib/email/threading", () => ({ resolveThreadId: vi.fn(), prismaThreadFinders: vi.fn() }));
vi.mock("@/lib/email/attachments-storage", () => ({ readAttachment: mocks.read }));
import { POST } from "@/app/api/emails/gmail/send/route";
const send = (extra = {}) => POST(new NextRequest("http://localhost/api/emails/gmail/send", { method: "POST", body: JSON.stringify({ to: ["creditor@example.com"], subject: "Negotiation", bodyText: "Draft", opportunityId: "opp", ...extra }) }));
beforeEach(() => { vi.resetAllMocks(); mocks.eligible.mockResolvedValue(true); mocks.auth.mockResolvedValue({ session: { userId: "me" } }); mocks.user.mockResolvedValue({ email: "rep@example.com" }); mocks.access.mockResolvedValue(true); mocks.send.mockResolvedValue({ id: "sent" }); });
it("uses Email Center permission checks", async () => { mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 403 }) }); expect((await send()).status).toBe(403); expect(mocks.auth).toHaveBeenCalledWith("Email.Send"); expect(mocks.send).not.toHaveBeenCalled(); });
it("rejects inaccessible opportunities before sending", async () => { mocks.access.mockResolvedValue(false); expect((await send()).status).toBe(404); expect(mocks.send).not.toHaveBeenCalled(); });
it("links mail to the opportunity and sends as the authenticated user's Gmail account", async () => { expect((await send()).status).toBe(201); expect(mocks.access).toHaveBeenCalledWith("opportunity", "opp"); expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ repEmail: "rep@example.com", repUserId: "me", record: { opportunityId: "opp" }, to: ["creditor@example.com"] }), expect.any(Object)); });
it("preserves existing Email Center sends without a record", async () => { expect((await send({ opportunityId: undefined })).status).toBe(201); expect(mocks.access).not.toHaveBeenCalled(); });
it("surfaces sender failures", async () => { mocks.send.mockRejectedValue(new Error("Mailbox unavailable")); const response = await send(); expect(response.status).toBe(502); expect((await response.json()).error).toBe("Mailbox unavailable"); });

it("keeps replies in the original Gmail thread", async () => { mocks.source.mockResolvedValue({ id: "original", ownerId: "me", opportunityId: "opp", messageIdHeader: "parent@example.com", gmailThreadId: "gmail-thread", attachments: [] }); expect((await send({ replyToMessageId: "original" })).status).toBe(201); expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ inReplyTo: "<parent@example.com>", gmailThreadId: "gmail-thread" }), expect.any(Object)); });
it("does not send a reply to a missing source", async () => { mocks.source.mockResolvedValue(null); expect((await send({ replyToMessageId: "missing" })).status).toBe(404); expect(mocks.send).not.toHaveBeenCalled(); });
it("rejects another mailbox's source email", async () => { mocks.source.mockResolvedValue({ ownerId: "other" }); expect((await send({ replyToMessageId: "other" })).status).toBe(403); expect(mocks.send).not.toHaveBeenCalled(); });

it("does not silently send without an unavailable attachment", async () => { mocks.read.mockResolvedValue(null); expect((await send({ attachments: [{ storagePath: "missing", filename: "agreement.pdf", contentType: "application/pdf" }] })).status).toBe(400); expect(mocks.send).not.toHaveBeenCalled(); });
it('blocks negotiation email when lifecycle eligibility changes',async()=>{mocks.eligible.mockResolvedValue(false);expect((await send({negotiation:true})).status).toBe(403);expect(mocks.send).not.toHaveBeenCalled();});
it('requires an opportunity for negotiation emails',async()=>{expect((await send({negotiation:true,opportunityId:undefined})).status).toBe(404);expect(mocks.send).not.toHaveBeenCalled();});
it('keeps general sales emails available on non-won opportunities',async()=>{mocks.eligible.mockResolvedValue(false);expect((await send()).status).toBe(201);expect(mocks.eligible).not.toHaveBeenCalled();});
