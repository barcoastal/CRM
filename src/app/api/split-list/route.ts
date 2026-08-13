import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

/**
 * Console split-view list: the most recent records of an object, rendered in
 * the collapsible left panel beside an open record (SF console split view).
 */
export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const entity = request.nextUrl.searchParams.get("entity") ?? "";
  const take = 30;

  interface Row {
    id: string;
    title: string;
    sub: string | null;
    meta: string | null;
    href: string;
  }
  let rows: Row[] = [];

  if (entity === "leads") {
    const leads = await prisma.lead.findMany({
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, contactName: true, businessName: true, phone: true },
    });
    rows = leads.map((l) => ({
      id: l.id,
      title: l.contactName || l.businessName || "(no name)",
      sub: l.businessName,
      meta: l.phone,
      href: `/leads/${l.id}`,
    }));
  } else if (entity === "opportunities") {
    const opps = await prisma.opportunity.findMany({
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, name: true, stage: true, currentTotalDebt: true, account: { select: { name: true } } },
    });
    rows = opps.map((o) => ({
      id: o.id,
      title: o.name ?? "(unnamed)",
      sub: o.account?.name ?? o.stage,
      meta: o.currentTotalDebt != null ? `$${o.currentTotalDebt.toLocaleString()}` : null,
      href: `/opportunities/${o.id}`,
    }));
  } else if (entity === "accounts") {
    const accounts = await prisma.account.findMany({
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, name: true, phone: true, recordType: true },
    });
    rows = accounts.map((a) => ({
      id: a.id,
      title: a.name,
      sub: a.recordType.replace(/_/g, " "),
      meta: a.phone,
      href: `/accounts/${a.id}`,
    }));
  } else if (entity === "contacts") {
    const contacts = await prisma.contact.findMany({
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, fullName: true, email: true, phone: true },
    });
    rows = contacts.map((ct) => ({
      id: ct.id,
      title: ct.fullName,
      sub: ct.email,
      meta: ct.phone,
      href: `/contacts/${ct.id}`,
    }));
  } else if (entity === "cases") {
    const cases = await prisma.case.findMany({
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, caseNumber: true, subject: true, status: true },
    });
    rows = cases.map((cs) => ({
      id: cs.id,
      title: cs.subject ?? cs.caseNumber,
      sub: cs.caseNumber,
      meta: cs.status,
      href: `/cases/${cs.id}`,
    }));
  } else {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }

  return NextResponse.json({ rows });
}
