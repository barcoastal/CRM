/**
 * Packet routing. Every deal gets the Coastal master agreement, plus the
 * processor agreement chosen in the calculator (SAS/RAM) and the legal plan
 * chosen by the file's creditors (Victory only if ALL are VLP, else Citadel).
 */
import { prisma } from "@/lib/prisma";
import { resolveAgreement } from "@/lib/creditor-agreements";
import { CATEGORIES, readTemplate, type ContractCategory } from "./templates";

export interface PacketPlan {
  categories: ContractCategory[];
  processor: "SAS" | "RAM";
  legal: "Victory" | "Citadel";
}

/** Decide which templates make up a deal's packet, in signing order. */
export async function planPacket(opportunityId: string): Promise<PacketPlan> {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { account: true, debts: true },
  });
  if (!opp) throw new Error("Opportunity not found");

  const raw = (opp.account?.paymentProcessor ?? "").toUpperCase();
  const processor: "SAS" | "RAM" = raw === "RAM" ? "RAM" : "SAS";
  const legal = resolveAgreement(opp.debts.map((d) => d.creditorName));

  return {
    processor,
    legal,
    categories: [
      "COASTAL",
      processor === "RAM" ? "PROCESSOR_RAM" : "PROCESSOR_SAS",
      legal === "Victory" ? "LEGAL_VICTORY" : "LEGAL_CITADEL",
    ],
  };
}

/** Load the routed templates' buffers; throws listing any category not yet uploaded. */
export async function loadPacketTemplates(
  plan: PacketPlan,
): Promise<{ category: ContractCategory; buffer: Buffer; name: string }[]> {
  const loaded = await Promise.all(
    plan.categories.map(async (category) => ({ category, buffer: await readTemplate(category) })),
  );
  const missing = loaded
    .filter((t) => !t.buffer)
    .map((t) => CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category);
  if (missing.length) {
    throw new Error(
      `This deal routes to ${plan.processor} + ${plan.legal}, but these templates are not uploaded yet: ${missing.join(", ")}. Upload them under Contract Templates.`,
    );
  }
  return loaded.map((t) => ({ category: t.category, buffer: t.buffer as Buffer, name: `${t.category}.docx` }));
}
