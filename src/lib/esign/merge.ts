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
import { PDFDocument, PDFTextField, StandardFonts, rgb } from "pdf-lib";
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

interface DataBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  mergeValue?: string;
}

/**
 * Stamp positioned CRM "data fields" onto a PDF (used for templates that have
 * no AcroForm fields, e.g. converted Word docs). Each box's `mergeValue` is
 * resolved against the merge context and drawn at its coordinates. Returns a
 * NEW PDF buffer. Coordinates are PDF points, origin bottom-left, (x,y) =
 * lower-left of the box — same convention as signature/date stamping.
 */
export async function stampDataBoxes(
  pdfBuffer: Buffer,
  dataBoxes: DataBox[],
  ctx: MergeContext,
): Promise<Buffer> {
  if (!Array.isArray(dataBoxes) || dataBoxes.length === 0) return pdfBuffer;
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  for (const box of dataBoxes) {
    if (!box || !box.mergeValue) continue;
    const value = resolvePath(box.mergeValue, ctx);
    if (!value) continue;
    const page = pages[(Number(box.page) || 1) - 1];
    if (!page) continue;
    const size = Math.min(11, Math.max(8, box.height ? box.height - 6 : 10));
    try {
      page.drawText(String(value), {
        x: box.x + 2,
        y: box.y + Math.max(2, (box.height - size) / 2),
        size,
        font,
        color: rgb(0.04, 0.04, 0.04),
      });
    } catch {
      // Non-WinAnsi glyphs (rare in CRM data) — skip rather than abort.
    }
  }
  const out = await pdfDoc.save();
  return Buffer.from(out);
}
