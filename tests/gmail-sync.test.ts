// tests/gmail-sync.test.ts
import { describe, it, expect, vi } from "vitest";
import { syncOneMailbox, type SyncDeps } from "@/lib/google/gmail-sync";
import type { GmailClient, GmailMessage } from "@/lib/google/gmail-client";

function msg(id: string, from: string, to: string, subject: string, messageId: string): GmailMessage {
  return {
    id,
    headers: [
      { name: "From", value: from },
      { name: "To", value: to },
      { name: "Subject", value: subject },
      { name: "Message-ID", value: messageId },
      { name: "Date", value: "Wed, 20 Aug 2026 10:00:00 -0400" },
    ],
    payload: { mimeType: "text/plain", body: { data: Buffer.from("hi").toString("base64url") } },
  };
}

function fakeClient(messages: GmailMessage[]): GmailClient {
  return {
    listRecent: async () => ({ messageIds: messages.map((m) => m.id), historyId: "1000" }),
    listHistory: async () => ({ messageIds: messages.map((m) => m.id), historyId: "1001" }),
    getMessage: async (id) => messages.find((m) => m.id === id)!,
  };
}

/** Build deps where matchByEmail returns a lead for a known address only. */
function makeDeps(created: Record<string, unknown>[], seenGmailIds = new Set<string>(), seenMsgHeaders = new Set<string>()): SyncDeps {
  return {
    matchByEmail: async (email: string) =>
      email === "client@brightpath.com" ? { leadId: "lead1", contactId: null, accountId: null, ownerId: "rep1" } : null,
    existsByGmailId: async (id: string) => seenGmailIds.has(id),
    existsByMessageIdHeader: async (h: string) => seenMsgHeaders.has(h),
    createMessage: async (data) => { created.push(data); },
    resolveThread: async () => null, // new thread -> self-anchor
  };
}

describe("syncOneMailbox", () => {
  it("stores only messages that match a CRM record", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([
      msg("g1", "Client X <client@brightpath.com>", "rep@coastaldebt.com", "Re: offer", "<a@x.com>"), // match
      msg("g2", "Random <nobody@gmail.com>", "rep@coastaldebt.com", "Lunch?", "<b@x.com>"), // no match -> skip
    ]);
    const res = await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: "999" }, client, makeDeps(created));
    expect(created).toHaveLength(1);
    expect(created[0].gmailMessageId).toBe("g1");
    expect(created[0].provider).toBe("GMAIL");
    expect(created[0].leadId).toBe("lead1");
    expect(res.stored).toBe(1);
    expect(res.newHistoryId).toBe("1001");
  });
  it("sets direction OUTBOUND when the rep sent it", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([msg("g3", "rep@coastaldebt.com", "Client X <client@brightpath.com>", "Following up", "<c@x.com>")]);
    await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: "999" }, client, makeDeps(created));
    expect(created[0].direction).toBe("OUTBOUND");
    expect(created[0].leadId).toBe("lead1"); // matched on the To counterparty
  });
  it("dedups by gmailMessageId and by messageIdHeader", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([msg("g1", "Client X <client@brightpath.com>", "rep@coastaldebt.com", "Re: offer", "<a@x.com>")]);
    const deps = makeDeps(created, new Set(["g1"]));
    const res = await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: "999" }, client, deps);
    expect(created).toHaveLength(0);
    expect(res.stored).toBe(0);
  });
  it("does an initial backfill when historyId is null", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([msg("g1", "Client X <client@brightpath.com>", "rep@coastaldebt.com", "Hi", "<a@x.com>")]);
    const listRecent = vi.fn(client.listRecent);
    const res = await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: null }, { ...client, listRecent }, makeDeps(created));
    expect(listRecent).toHaveBeenCalled();
    expect(res.newHistoryId).toBe("1000");
  });
});
