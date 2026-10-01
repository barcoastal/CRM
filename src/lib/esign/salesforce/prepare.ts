import { createHash, randomUUID } from "node:crypto";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { loadPacketTemplates } from "@/lib/contracts/routing";
import { CATEGORIES } from "@/lib/contracts/templates";
import { buildContractDataFromSnapshot } from "@/lib/contracts/merge-data";
import { fillDocxToPdf } from "@/lib/contracts/docx-merge";
import { prepareAnchoredPacket } from "@/lib/contracts/anchors";
import { orderedFields } from "../fields";
import { saveEnvelopePdf } from "../storage";
import type { PacketField } from "../packet-config";
import {
  pilotPacketId,
  type PilotConfig,
  type SalesforceSnapshot,
} from "./policy";
export async function prepareSalesforcePilot(
  s: SalesforceSnapshot,
  c: PilotConfig,
) {
  const id = pilotPacketId(c.orgId, s.opportunityId, s.requestId);
  const snapshotHash = createHash("sha256")
    .update(JSON.stringify(s))
    .digest("hex");
  const existing = await prisma.signingPacket.findUnique({ where: { id } });
  if (existing) return existing;
  const { templates, missing } = await loadPacketTemplates({
    processor: s.processor,
    legal: "Citadel",
    categories: [
      "COASTAL",
      ...(s.includeAddendum ? ["ADDENDUM" as const] : []),
      s.processor === "RAM" ? "PROCESSOR_RAM" : "PROCESSOR_SAS",
      "LEGAL_CITADEL",
    ],
  });
  if (missing.length)
    throw new Error(`Missing templates: ${missing.join(", ")}`);
  // The pilot uses the established CRM sample schedule defaults; it is deliberately
  // marked non-contractual. Live Salesforce quote parity is a separate release gate.
  const data = buildContractDataFromSnapshot({
    totalDebt: s.totalDebt,
    account: {
      name: s.accountName,
      billingStreet: s.street,
      billingCity: s.city,
      billingState: s.state,
      billingZip: s.postalCode,
      paymentProcessor: s.processor,
      email: s.signerEmail,
    },
    primaryContact: {
      fullName: s.signerName,
      firstName: s.signerName.split(" ")[0],
      lastName: s.signerName.split(" ").slice(1).join(" "),
      email: s.signerEmail,
    },
    debts: [],
    paymentCalculations: [],
  });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const documents = [];
  const fields: PacketField[] = [];
  for (const t of templates) {
    const anchored = await prepareAnchoredPacket(
      await fillDocxToPdf(t.buffer, data, t.name),
    );
    const part = await PDFDocument.load(anchored.pdf);
    const startPage = pdf.getPageCount() + 1;
    for (const page of await pdf.copyPages(part, part.getPageIndices())) {
      pdf.addPage(page);
      page.drawRectangle({
        x: 0,
        y: page.getHeight() - 23,
        width: page.getWidth(),
        height: 23,
        color: rgb(1, 0.94, 0.78),
      });
      page.drawText("TEST - NOT A CONTRACT | Salesforce sandbox pilot", {
        x: 20,
        y: page.getHeight() - 16,
        size: 10,
        font,
        color: rgb(0.5, 0.1, 0.1),
      });
    }
    fields.push(
      ...orderedFields({ ...anchored, checkboxBoxes: [] }).map((f) => ({
        ...f,
        id: randomUUID(),
        page: f.page + startPage - 1,
        recipientId: "primary",
        required: f.required !== false,
      })),
    );
    documents.push({
      id: randomUUID(),
      name: `[TEST] ${CATEGORIES.find((x) => x.key === t.category)?.label ?? t.category}`,
      startPage,
      pageCount: part.getPageCount(),
    });
  }
  const preparedPdfPath = await saveEnvelopePdf(
    Buffer.from(await pdf.save()),
    randomUUID(),
  );
  const packet = {
    id,
    name: `[TEST] ${s.accountName} - Salesforce pilot`,
    createdById: c.senderUserId,
    preparedPdfPath,
    salesforceSource: {
      orgId: c.orgId,
      opportunityId: s.opportunityId,
      requestId: s.requestId,
      recipientEmail: c.recipientEmail,
      sandbox: true,
      returnUrl: `${c.instanceUrl}/lightning/r/Opportunity/${s.opportunityId}/view`,
      snapshotHash,
    },
    config: {
      documents,
      fields,
      recipients: [
        {
          id: "primary",
          name: s.signerName,
          email: s.signerEmail,
          action: "SIGN",
          order: 1,
        },
      ],
      subject: "[TEST] Coastal E-Sign sandbox - NOT A CONTRACT",
      message:
        "TEST ONLY - NOT A CONTRACT. Please review this sandbox sample to test the signing flow.",
      reminderDays: 0,
      expiresDays: 7,
    },
  };
  try {
    return await prisma.signingPacket.create({ data: packet });
  } catch (e) {
    const winner = await prisma.signingPacket.findUnique({ where: { id } });
    if (winner) return winner;
    throw e;
  }
}
