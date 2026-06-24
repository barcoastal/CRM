/**
 * One-time importer for historical DocuSign envelopes.
 *
 *   POST /api/admin/import-docusign?secret=...&limit=25&start=0&fromDate=2015-01-01[&dryRun=1]
 *
 * Lists COMPLETED DocuSign envelopes, downloads each signed PDF, matches the
 * signer email to an Account/Opportunity (falls back to unmatched), and creates
 * a COMPLETED Envelope record. Idempotent via Envelope.externalId. Processes one
 * page per call (use the returned `nextStart` to page through). Gated by the
 * DOCUSIGN_IMPORT_SECRET env var.
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { dsGet, dsGetCombinedPdf } from "@/lib/docusign/client";
import { signedDir } from "@/lib/esign/storage";

export const runtime = "nodejs";

interface DsSigner {
  name?: string;
  email?: string;
  signedDateTime?: string;
}
interface DsEnvelope {
  envelopeId: string;
  status?: string;
  emailSubject?: string;
  sentDateTime?: string;
  completedDateTime?: string;
  createdDateTime?: string;
  recipients?: { signers?: DsSigner[] };
}
interface DsListResponse {
  envelopes?: DsEnvelope[];
  resultSetSize?: string;
  totalSetSize?: string;
}

function toDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function matchByEmail(
  email: string | undefined,
): Promise<{ accountId?: string; opportunityId?: string; leadId?: string }> {
  const e = (email ?? "").trim();
  if (!e) return {};
  const acct = await prisma.account.findFirst({
    where: { email: { equals: e, mode: "insensitive" } },
    select: { id: true },
  });
  if (acct) {
    const opp = await prisma.opportunity.findFirst({
      where: { accountId: acct.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return { accountId: acct.id, opportunityId: opp?.id };
  }
  const contact = await prisma.contact.findFirst({
    where: { email: { equals: e, mode: "insensitive" } },
    select: { primaryAccountId: true },
  });
  if (contact?.primaryAccountId) {
    const opp = await prisma.opportunity.findFirst({
      where: { accountId: contact.primaryAccountId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return { accountId: contact.primaryAccountId, opportunityId: opp?.id };
  }
  const lead = await prisma.lead.findFirst({
    where: { email: { equals: e, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, convertedAccountId: true, convertedOpportunityId: true },
  });
  if (lead) {
    return {
      accountId: lead.convertedAccountId ?? undefined,
      opportunityId: lead.convertedOpportunityId ?? undefined,
      leadId: lead.id,
    };
  }
  return {};
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.DOCUSIGN_IMPORT_SECRET || secret !== process.env.DOCUSIGN_IMPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25")));
  const start = Math.max(0, parseInt(url.searchParams.get("start") ?? "0"));
  const fromDate = url.searchParams.get("fromDate") ?? "2015-01-01";
  const dryRun = url.searchParams.get("dryRun") === "1";

  let list: DsListResponse;
  try {
    list = await dsGet<DsListResponse>(
      `/envelopes?from_date=${encodeURIComponent(fromDate)}&status=completed&include=recipients&count=${limit}&start_position=${start}`,
    );
  } catch (e) {
    return NextResponse.json(
      { error: "DocuSign list failed", details: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  const envelopes = list.envelopes ?? [];
  const totalSetSize = Number(list.totalSetSize ?? envelopes.length);
  const result = {
    processed: 0,
    imported: 0,
    skipped: 0,
    matched: 0,
    unmatched: 0,
    errors: [] as { envelopeId: string; error: string }[],
    totalSetSize,
    start,
    nextStart: start + envelopes.length,
    done: start + envelopes.length >= totalSetSize,
    dryRun,
  };

  await fs.mkdir(signedDir(), { recursive: true });

  for (const env of envelopes) {
    result.processed++;
    try {
      const existing = await prisma.envelope.findUnique({
        where: { externalId: env.envelopeId },
        select: { id: true },
      });
      if (existing) {
        result.skipped++;
        continue;
      }
      const signer = (env.recipients?.signers ?? []).find((s) => s.email) ?? env.recipients?.signers?.[0];
      const match = await matchByEmail(signer?.email);
      if (match.accountId || match.opportunityId) result.matched++;
      else result.unmatched++;

      if (dryRun) {
        result.imported++;
        continue;
      }

      const created = await prisma.envelope.create({
        data: {
          externalSource: "DOCUSIGN",
          externalId: env.envelopeId,
          status: "COMPLETED",
          recordType: "OTHER",
          signerName: signer?.name ?? signer?.email ?? "Unknown signer",
          signerEmail: signer?.email ?? "",
          documentName: env.emailSubject?.trim() || "DocuSign Document",
          templateName: "Imported from DocuSign",
          sentAt: toDate(env.sentDateTime),
          signedAt: toDate(signer?.signedDateTime ?? env.completedDateTime),
          completedAt: toDate(env.completedDateTime),
          accountId: match.accountId ?? null,
          opportunityId: match.opportunityId ?? null,
          leadId: match.leadId ?? null,
        },
        select: { id: true },
      });

      const pdf = await dsGetCombinedPdf(env.envelopeId);
      const filename = `${created.id}-signed.pdf`;
      await fs.writeFile(path.join(signedDir(), filename), pdf);
      await prisma.envelope.update({
        where: { id: created.id },
        data: { signedDocumentUrl: filename },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ envelopeId: env.envelopeId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}
