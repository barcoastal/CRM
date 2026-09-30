import { NextRequest, NextResponse } from "next/server";
import { planPacket } from "@/lib/contracts/routing";
import { listTemplates } from "@/lib/contracts/templates";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
const value = z.string().trim().max(250);
const schema = z.object({
  account: z.object({
    name: value.min(1),
    ein: value,
    billingStreet: value.min(1),
    billingCity: value.min(1),
    billingState: value.min(1),
    billingZip: value.min(1),
    billingCountry: value.min(1),
    bankName: value.min(1),
    bankRoutingNumber: z.string().regex(/^\d{9}$/),
    bankAccountNumber: z.string().regex(/^\d{4,17}$/),
    bankAccountType: z.enum(["Checking", "Savings"]),
  }),
  contact: z.object({
    firstName: value.min(1),
    lastName: value.min(1),
    email: z.email(),
    phone: value,
    birthdate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v);
        return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
      }, "Invalid birthdate")
      .optional(),
  }),
});
type C = { params: Promise<{ id: string }> };
export async function GET(_r: NextRequest, c: C) {
  const a = await requireAuthOrRespond("Opportunity.View");
  if ("response" in a) return a.response;
  const { id } = await c.params;
  const o = await prisma.opportunity.findUnique({
    where: { id },
    include: { account: true, primaryContact: true },
  });
  if (!o?.account)
    return NextResponse.json(
      { error: "Link an account before preparing a contract." },
      { status: 400 },
    );
  const plan = await planPacket(id);
  const templates = await listTemplates();
  const b = o.account;
  const contact = o.primaryContact;
  return NextResponse.json({
    includeAddendum: !!o.addendumRequired,
    documents: plan.categories.map((category) => {
      const template = templates.find((item) => item.category === category)!;
      return { name: template.originalName ?? template.label, available: !!template.originalName };
    }),
    account: Object.fromEntries(
      [
        "name",
        "ein",
        "billingStreet",
        "billingCity",
        "billingState",
        "billingZip",
        "billingCountry",
        "bankName",
        "bankRoutingNumber",
        "bankAccountNumber",
        "bankAccountType",
      ].map((k) => [k, (b as unknown as Record<string, unknown>)[k] ?? ""]),
    ),
    contact: {
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      email: contact?.email ?? b.email ?? "",
      phone: contact?.phone ?? b.phone ?? "",
      birthdate: contact?.birthdate?.toISOString().slice(0, 10) ?? "",
    },
    legalNetwork: plan.legal,
    processor: plan.processor,
    ssn: b.ssnLast4 ? `XXX-XX-${b.ssnLast4}` : "Not recorded",
    totalDebt: o.currentTotalDebt ?? o.totalDebt ?? b.currentTotalDebt ?? 0,
  });
}
export async function PATCH(req: NextRequest, c: C) {
  const a = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in a) return a.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  const { id } = await c.params;
  const o = await prisma.opportunity.findUnique({
    where: { id },
    select: { accountId: true, primaryContactId: true },
  });
  if (!o?.accountId || !o.primaryContactId)
    return NextResponse.json(
      { error: "Link both an account and a primary contact before saving." },
      { status: 400 },
    );
  const d = parsed.data;
  const digits = d.account.bankRoutingNumber.split("").map(Number);
  if (
    (3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      digits[2] +
      digits[5] +
      digits[8]) %
      10 !==
      0 ||
    /^0+$/.test(d.account.bankRoutingNumber)
  )
    return NextResponse.json(
      { error: "Bank routing number is not valid." },
      { status: 400 },
    );
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        userId: a.session.userId,
        entity: "Opportunity",
        entityId: id,
        action: "CONTRACT_REVIEW",
        after: {
          updatedAccountFields: Object.keys(d.account),
          updatedContactFields: Object.keys(d.contact),
        },
      },
    }),
    prisma.account.update({ where: { id: o.accountId }, data: d.account }),
    prisma.contact.update({
      where: { id: o.primaryContactId },
      data: {
        ...d.contact,
        birthdate: d.contact.birthdate
          ? new Date(d.contact.birthdate)
          : undefined,
        fullName: `${d.contact.firstName} ${d.contact.lastName}`,
      },
    }),
  ]);
  return NextResponse.json({
    ok: true,
    signerName: `${d.contact.firstName} ${d.contact.lastName}`,
    signerEmail: d.contact.email,
  });
}
