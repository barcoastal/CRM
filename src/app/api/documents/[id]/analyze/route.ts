import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { analyzeContract, mimeForFile } from "@/lib/contract-analysis";

const MAX_BYTES = 18 * 1024 * 1024; // Gemini inline limit ~20MB

// GET - return the saved analysis (null when never analyzed).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { analysisJson: true, analyzedAt: true, name: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ analysis: doc.analysisJson, analyzedAt: doc.analyzedAt, name: doc.name });
}

// POST - run (or re-run) the AI analysis and save it on the document.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mime = mimeForFile(doc.name) ?? mimeForFile(doc.filePath);
  if (!mime) {
    return NextResponse.json(
      { error: "Only PDF and image files can be analyzed." },
      { status: 400 },
    );
  }

  const abs = path.isAbsolute(doc.filePath) ? doc.filePath : path.join(process.cwd(), doc.filePath);
  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return NextResponse.json({ error: "The stored file could not be read." }, { status: 404 });
  }
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large to analyze (max 18MB)." }, { status: 400 });
  }

  try {
    const analysis = await analyzeContract(buf, mime);
    const updated = await prisma.document.update({
      where: { id },
      data: { analysisJson: analysis as object, analyzedAt: new Date() },
      select: { analysisJson: true, analyzedAt: true },
    });

    // Funding agreements become debt rows automatically: creditor = funder,
    // balance = total payback (falls back to amount funded).
    let debtCreated: { creditorName: string; amount: number } | null = null;
    let debtLinked = false;
    const isAgreement = /agreement|mca|loan|advance|contract/i.test(analysis.docType ?? "");
    const balance = analysis.paybackAmount ?? analysis.fundingAmount;
    if (isAgreement && analysis.funderName && balance != null && balance > 0 && doc.opportunityId) {
      const existing = await prisma.debt.findFirst({
        where: {
          opportunityId: doc.opportunityId,
          creditorName: { contains: analysis.funderName.slice(0, 25), mode: "insensitive" },
        },
      });
      if (existing) {
        if (!existing.sourceDocumentId) {
          await prisma.debt.update({ where: { id: existing.id }, data: { sourceDocumentId: doc.id } });
        }
        debtLinked = true;
      } else {
        const FREQ: Record<string, string> = { daily: "DAILY", weekly: "WEEKLY", "bi-weekly": "BI_WEEKLY", biweekly: "BI_WEEKLY", monthly: "MONTHLY" };
        await prisma.debt.create({
          data: {
            opportunityId: doc.opportunityId,
            creditorName: analysis.funderName,
            debtType: "MCA",
            originalBalance: balance,
            currentBalance: balance,
            enrolledBalance: balance,
            paymentAmount: analysis.paymentAmount ?? null,
            paymentFrequency: analysis.paymentFrequency ? FREQ[analysis.paymentFrequency.toLowerCase()] ?? null : null,
            status: "ENROLLED",
            sourceDocumentId: doc.id,
          },
        });
        const sum = await prisma.debt.aggregate({
          where: { opportunityId: doc.opportunityId },
          _sum: { originalBalance: true },
        });
        const totalDebt = sum._sum.originalBalance;
        if (totalDebt != null) {
          await prisma.opportunity
            .update({ where: { id: doc.opportunityId }, data: { totalDebt, currentTotalDebt: totalDebt } })
            .catch(() => undefined);
        }
        debtCreated = { creditorName: analysis.funderName, amount: balance };
      }
    }

    return NextResponse.json({
      analysis: updated.analysisJson,
      analyzedAt: updated.analyzedAt,
      debtCreated,
      debtLinked,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
