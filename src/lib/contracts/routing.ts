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

/**
 * Load the routed templates that ARE uploaded, in order. Missing ones are
 * skipped (so a partial packet can still be tested/sent) and reported back.
 * Throws only if none of the routed templates exist.
 */
export async function loadPacketTemplates(
  plan: PacketPlan,
): Promise<{
  templates: { category: ContractCategory; buffer: Buffer; name: string }[];
  missing: string[];
}> {
  const loaded = await Promise.all(
    plan.categories.map(async (category) => ({ category, buffer: await readTemplate(category) })),
  );
  const templates = loaded
    .filter((t) => t.buffer)
    .map((t) => ({ category: t.category, buffer: t.buffer as Buffer, name: `${t.category}.docx` }));
  const missing = loaded
    .filter((t) => !t.buffer)
    .map((t) => CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category);
  if (templates.length === 0) {
    throw new Error(
      `This deal routes to Coastal + ${plan.processor} + ${plan.legal}, but none of those templates are uploaded yet. Upload at least the Coastal agreement under Contract Templates.`,
    );
  }
  return { templates, missing };
}
