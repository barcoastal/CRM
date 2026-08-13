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
  const view = request.nextUrl.searchParams.get("view") ?? "recent";
  const take = 30;

  // View picker contents (SF list-view selector): computed views + one view
  // per active user, like the org's per-person lists.
  if (request.nextUrl.searchParams.get("views") === "1") {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({
      views: [
        { value: "recent", label: "Recently Viewed" },
        { value: "mine", label: "My Records" },
        { value: "this-week", label: "This Week" },
        ...users.map((u) => ({ value: `owner:${u.id}`, label: u.name })),
      ],
    });
  }

  // Owner filtering shared by all entities below.
  const ownerFilter = (field: "assignedToId" | "ownerId"): Record<string, unknown> => {
    if (view === "mine") return { [field]: r.session.userId };
    if (view.startsWith("owner:")) return { [field]: view.slice(6) };
    if (view === "this-week") {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return { createdAt: { gte: weekStart } };
    }
    return {};
  };

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
      where: ownerFilter("assignedToId"),
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
      where: ownerFilter("assignedToId"),
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
      where: ownerFilter("ownerId"),
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
      where: ownerFilter("ownerId"),
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
