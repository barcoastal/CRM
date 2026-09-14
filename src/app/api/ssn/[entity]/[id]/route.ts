import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canRevealSsn } from "@/lib/ssn-privacy";

const entities = { contact: "Contact", account: "Account", opportunity: "Opportunity", lead: "Lead" } as const;
function snapshotSsn(json: string | null): string | null {
  try {
    const row = JSON.parse(json || "{}");
    const value = row.SSN__c || row.SSN_Encrypted__c || row.SSN;
    return typeof value === "string" ? value : null;
  } catch { return null; }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const headers = { "Cache-Control": "no-store, private", "Pragma": "no-cache" };
  const { entity, id } = await ctx.params;
  if (!Object.hasOwn(entities, entity)) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const r = await requireAuthOrRespond(`${entities[entity as keyof typeof entities]}.View`);
  if ("response" in r) return r.response;
  const user = await prisma.user.findUnique({ where: { id: r.session.userId }, select: { role: true, isActive: true } });
  if (!user?.isActive || !canRevealSsn(user.role)) return NextResponse.json({ error: "Admin access required" }, { status: 403, headers });
  const origin = req.headers.get("origin");
  // Railway terminates HTTPS before forwarding to the custom HTTP server.
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || req.nextUrl.host;
  const protocol = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || req.nextUrl.protocol.slice(0, -1);
  if (origin && origin !== `${protocol}://${host}`) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  let ssn: string | null = null;
  let found = false;
  if (entity === "contact") {
    const row = await prisma.contact.findUnique({ where: { id }, select: { ssn: true } });
    found = !!row; ssn = row?.ssn ?? null;
  } else if (entity === "account") {
    const row = await prisma.account.findUnique({ where: { id }, select: { sfDataJson: true, primaryContact: { select: { ssn: true } } } });
    found = !!row; ssn = row ? snapshotSsn(row.sfDataJson) || row.primaryContact?.ssn || null : null;
  } else if (entity === "opportunity") {
    const row = await prisma.opportunity.findUnique({ where: { id }, select: { contactSsn: true, sfDataJson: true, primaryContact: { select: { ssn: true } } } });
    found = !!row; ssn = row ? row.contactSsn || row.primaryContact?.ssn || snapshotSsn(row.sfDataJson) : null;
  } else {
    const row = await prisma.lead.findUnique({ where: { id }, select: { sfDataJson: true } });
    found = !!row; ssn = row ? snapshotSsn(row.sfDataJson) : null;
  }
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  // Audit access, never the identity value itself. A failed audit prevents disclosure.
  await prisma.auditLog.create({ data: { userId: r.session.userId, entity: entities[entity as keyof typeof entities], entityId: id, action: "REVEAL_SSN" } });
  return NextResponse.json({ ssn }, { headers });
}
