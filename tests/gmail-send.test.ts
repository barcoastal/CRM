// tests/gmail-send.test.ts
import { describe, it, expect, vi } from "vitest";
import { sendGmail, type SendDeps, type SendInput } from "@/lib/google/gmail-send";

function baseInput(over: Partial<SendInput> = {}): SendInput {
  return {
    repEmail: "rep@coastaldebt.com",
    repUserId: "rep1",
    to: ["client@brightpath.com"],
    subject: "Hello",
    bodyText: "Hi",
    attachments: [],
    ...over,
  };
}

function makeDeps(created: Record<string, unknown>[], attachRows: Record<string, unknown>[][]): SendDeps {
  return {
    send: vi.fn(async () => ({ id: "gm123", threadId: "gt456" })),
    resolveThread: async () => null,
    generateMessageId: (domain) => `<newid@${domain}>`,
    persist: async (msg, atts) => {
      created.push(msg);
      attachRows.push(atts as unknown as Record<string, unknown>[]);
      return { id: "em1" };
    },
  };
}

describe("sendGmail", () => {
  it("sends via Gmail and persists an OUTBOUND GMAIL message with our message-id and gmail ids", async () => {
    const created: Record<string, unknown>[] = [];
    const attachRows: Record<string, unknown>[][] = [];
    const deps = makeDeps(created, attachRows);
    const res = await sendGmail(baseInput(), deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(res.gmailId).toBe("gm123");
    expect(created[0].provider).toBe("GMAIL");
    expect(created[0].direction).toBe("OUTBOUND");
    expect(created[0].status).toBe("SENT");
    expect(created[0].ownerId).toBe("rep1");
    expect(created[0].gmailMessageId).toBe("gm123");
    expect(created[0].gmailThreadId).toBe("gt456");
    expect(created[0].messageIdHeader).toBe("newid@coastaldebt.com");
    expect(created[0].toAddresses).toBe("client@brightpath.com");
  });

  it("passes the gmail thread id through on a reply and carries record links", async () => {
    const created: Record<string, unknown>[] = [];
    const attachRows: Record<string, unknown>[][] = [];
    const deps = makeDeps(created, attachRows);
    await sendGmail(
      baseInput({
        subject: "Re: Offer",
        inReplyTo: "<orig@brightpath.com>",
        references: "<orig@brightpath.com>",
        gmailThreadId: "gt456",
        record: { leadId: "lead1" },
      }),
      deps,
    );
    expect(deps.send).toHaveBeenCalledWith(expect.any(String), "gt456");
    expect(created[0].inReplyTo).toBe("orig@brightpath.com");
    expect(created[0].leadId).toBe("lead1");
  });

  it("persists attachment rows for uploaded files", async () => {
    const created: Record<string, unknown>[] = [];
    const attachRows: Record<string, unknown>[][] = [];
    const deps = makeDeps(created, attachRows);
    await sendGmail(
      baseInput({
        attachments: [{ filename: "a.pdf", contentType: "application/pdf", content: Buffer.from("X"), storagePath: "abcd-a.pdf" }],
      }),
      deps,
    );
    expect(attachRows[0]).toHaveLength(1);
    expect(attachRows[0][0]).toMatchObject({ filename: "a.pdf", contentType: "application/pdf", byteSize: 1, storagePath: "abcd-a.pdf" });
  });
});
