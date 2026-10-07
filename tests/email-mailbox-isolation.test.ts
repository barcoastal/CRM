import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  messages: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { emailMessage: { findMany: mocks.messages } } }));

import { GET as getEmails } from "@/app/api/emails/route";
import { GET as getRecordActivity } from "@/app/api/email-center/reports/record-activity/route";

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ session: { userId: "closer-id", role: "SALES_REP" } });
  mocks.messages.mockReset().mockResolvedValue([]);
});

describe("email mailbox isolation", () => {
  it("scopes a closer's record-filtered message query to their own mailbox", async () => {
    await getEmails(new NextRequest("https://crm.test/api/emails?accountId=shared-account&ownerId=admin-id"));
    expect(mocks.messages).toHaveBeenCalledWith(expect.objectContaining({
      where: { accountId: "shared-account", ownerId: "closer-id" },
    }));
  });

  it("scopes record activity to the closer's own mailbox", async () => {
    await getRecordActivity(new NextRequest("https://crm.test/api/email-center/reports/record-activity?entity=lead&id=shared-lead"));
    expect(mocks.messages).toHaveBeenCalledWith(expect.objectContaining({
      where: { leadId: "shared-lead", ownerId: "closer-id" },
    }));
  });

  it("keeps the admin's cross-mailbox view available", async () => {
    mocks.auth.mockResolvedValue({ session: { userId: "admin-id", role: "ADMIN" } });
    await getEmails(new NextRequest("https://crm.test/api/emails?ownerId=closer-id"));
    expect(mocks.messages).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "closer-id" },
    }));
  });
});
