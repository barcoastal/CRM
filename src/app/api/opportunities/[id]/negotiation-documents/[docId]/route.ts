import { isNegotiationEligible } from "@/lib/negotiation-access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { canAccessRecord } from "@/lib/record-access";
import { serveDocument } from "@/lib/document-serve";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const auth = await requireAuthOrRespond("Opportunity.View");
  if ("response" in auth) return auth.response;
  const { id, docId } = await params;
  if (!await canAccessRecord("opportunity", id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!await isNegotiationEligible(id)) return NextResponse.json({ error: "Negotiations require a Closed Won opportunity and an Active account." }, { status: 403 });
  const opportunity = await prisma.opportunity.findUnique({ where: { id }, select: { accountId: true, leadId: true } });
  const related: { accountId?: string; leadId?: string }[] = [];
  if (opportunity?.accountId && await canAccessRecord("account", opportunity.accountId)) related.push({ accountId: opportunity.accountId });
  if (opportunity?.leadId && await canAccessRecord("lead", opportunity.leadId)) related.push({ leadId: opportunity.leadId });
  const doc = await prisma.document.findFirst({ where: { id: docId, OR: [...related, { opportunityId: id }, { debtsFromThis: { some: { opportunityId: id } } }] } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return serveDocument(doc, request.nextUrl.searchParams.get("view") === "1");
}
