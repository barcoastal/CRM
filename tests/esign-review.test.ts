import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ update: vi.fn(), contact: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: async () => ({ session: { userId: "tester" } }) }));
vi.mock("@/lib/contracts/routing", () => ({ planPacket: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  opportunity: { findUnique: async () => ({ accountId: "a", primaryContactId: "c" }) },
  account: { update: mocks.update }, contact: { update: mocks.contact },
  auditLog: { create: vi.fn() }, $transaction: async (queries: unknown[]) => Promise.all(queries),
} }));
import { PATCH } from "@/app/api/esign/review/[id]/route";
it.each([undefined, "", "USA"])("saves country without requiring or overwriting county (%s)", async (county) => {
  const response = await PATCH(new NextRequest("http://localhost/api/esign/review/test", {
    method: "PATCH", body: JSON.stringify({
      account: { name: "Test Company", ein: "", billingStreet: "1 Test Street", billingCity: "Test City", billingState: "CA", billingZip: "90001", billingCountry: "United States", billingCounty: county, bankName: "Test Bank", bankRoutingNumber: "021000021", bankAccountNumber: "12345678", bankAccountType: "Checking" },
      contact: { firstName: "Test", lastName: "Signer", email: "test@example.com", phone: "" },
    }),
  }), { params: Promise.resolve({ id: "test" }) });
  expect(response.status).toBe(200);
  const saved = mocks.update.mock.lastCall?.[0].data;
  expect(saved.billingCountry).toBe("United States");
  expect(saved).not.toHaveProperty("billingCounty");
});
