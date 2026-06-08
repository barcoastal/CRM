/**
 * Merge engine for envelope templates.
 *
 * Workflow:
 *  1. `buildMergeContextForOpportunity` loads the opp + account + contact +
 *     sender user in one shot.
 *  2. `fillAcroForm` walks the template's mergeMapping {fieldName: mergePath}
 *     and fills every AcroForm text field it can resolve. Missing fields and
 *     non-text widgets are silently ignored, so a partially-broken template
 *     still produces a usable PDF.
 *
 * Note: we do NOT flatten the form here. Chunk 3 stamps signatures, then
 * flattens at completion time.
 */
import { PDFDocument, PDFTextField } from "pdf-lib";
import { prisma } from "@/lib/prisma";

export interface MergeContext {
  account?: unknown;
  contact?: unknown;
  opportunity?: unknown;
  lead?: unknown;
  user?: unknown;
  today: string;
}

/** Fetch all related rows for an opportunity in one query. */
export async function buildMergeContextForOpportunity(
  opportunityId: string,
  senderUserId?: string,
): Promise<MergeContext> {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      account: true,
      primaryContact: true,
      lead: true,
    },
  });
  if (!opp) throw new Error("Opportunity not found");

  const user = senderUserId
    ? await prisma.user.findUnique({
        where: { id: senderUserId },
        select: { id: true, name: true, email: true },
      })
    : null;

  const today = new Date().toISOString().slice(0, 10);

  return {
    account: opp.account ?? undefined,
    contact: opp.primaryContact ?? undefined,
    opportunity: opp,
    lead: opp.lead ?? undefined,
    user: user ?? undefined,
    today,
  };
}

/** Resolve "account.firstName" or "opportunity.totalDebt" against context. */
export function resolvePath(path: string, ctx: MergeContext): string {
  if (!path) return "";
  if (path === "today") return ctx.today;

  const parts = path.split(".");
  let cur: unknown = ctx as unknown;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur == null) return "";
  if (cur instanceof Date) return cur.toISOString().slice(0, 10);
  if (typeof cur === "number") {
    // Format money-ish if name looks like an amount / fee / debt field.
    if (/amount|debt|payment|fee|balance|revenue/i.test(path)) {
      return cur.toLocaleString("en-US", { style: "currency", currency: "USD" });
    }
    return String(cur);
  }
  if (typeof cur === "boolean") return cur ? "Yes" : "No";
  return String(cur);
}

/**
 * Apply mergeMapping to the AcroForm of a PDF and return a NEW PDF Buffer.
 * Wraps each setText in a try/catch so a malformed field type or missing
 * widget never aborts the whole fill.
 */
export async function fillAcroForm(
  pdfBuffer: Buffer,
  mergeMapping: Record<string, string>,
  ctx: MergeContext,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const form = pdfDoc.getForm();

  for (const [fieldName, mergePath] of Object.entries(mergeMapping)) {
    if (!fieldName || !mergePath) continue;
    const value = resolvePath(mergePath, ctx);
    try {
      const field = form.getTextField(fieldName);
      if (field instanceof PDFTextField) {
        field.setText(value);
      }
    } catch {
      // Field missing, not a text field, or unsupported widget. Keep going so
      // one bad mapping does not break the whole envelope.
    }
  }

  // updateFieldAppearances triggers pdf-lib to render any new text into the
  // existing widget streams so viewers without a form engine still see the
  // merged values.
  try {
    form.updateFieldAppearances();
  } catch {
    // Some PDFs ship with embedded fonts that pdf-lib cannot subset; ignore.
  }

  const out = await pdfDoc.save();
  return Buffer.from(out);
}
