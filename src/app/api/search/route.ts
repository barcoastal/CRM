import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface SearchResult {
  id: string;
  entity: "Lead" | "Contact" | "Account" | "Opportunity";
  title: string;
  subtitle: string;
}

export async function GET(req: Request) {
  const authed = await requireAuthOrRespond();
  if ("response" in authed) return authed.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = `%${q}%`;
  const limit = 8;

  const [leads, contacts, accounts, opps] = await Promise.all([
    prisma.lead.findMany({
      where: {
        OR: [
          { contactName: { contains: q, mode: "insensitive" } },
          { businessName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { sfId: q.match(/^[a-zA-Z0-9]{15,18}$/) ? q : undefined },
        ].filter(Boolean) as never,
      },
      select: { id: true, contactName: true, businessName: true, email: true, phone: true, status: true },
      take: limit,
    }),
    prisma.contact.findMany({
      where: {
        OR: [
          // fullName covers first/last; separate clauses would need two more
          // trigram indexes for no extra recall.
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { sfId: q.match(/^[a-zA-Z0-9]{15,18}$/) ? q : undefined },
        ].filter(Boolean) as never,
      },
      select: { id: true, fullName: true, email: true, phone: true, title: true },
      take: limit,
    }),
    prisma.account.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { ein: { contains: q } },
          { sfId: q.match(/^[a-zA-Z0-9]{15,18}$/) ? q : undefined },
        ].filter(Boolean) as never,
      },
      select: { id: true, name: true, email: true, phone: true, clientStatus: true },
      take: limit,
    }),
    prisma.opportunity.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { oppEmail: { contains: q, mode: "insensitive" } },
          { oppPhone: { contains: q } },
          { sfId: q.match(/^[a-zA-Z0-9]{15,18}$/) ? q : undefined },
        ].filter(Boolean) as never,
      },
      select: { id: true, name: true, stage: true, totalDebt: true, oppEmail: true, oppPhone: true },
      take: limit,
    }),
  ]);

  const results = ([
    ...leads.map((l) => ({
      id: l.id,
      entity: "Lead" as const,
      title: l.contactName || l.businessName || "Unnamed Lead",
      subtitle: [l.businessName, l.email, l.phone, l.status].filter(Boolean).join(" · "),
    })),
    ...contacts.map((c) => ({
      id: c.id,
      entity: "Contact" as const,
      title: c.fullName || "Unnamed Contact",
      subtitle: [c.title, c.email, c.phone].filter(Boolean).join(" · "),
    })),
    ...accounts.map((a) => ({
      id: a.id,
      entity: "Account" as const,
      title: a.name,
      subtitle: [a.email, a.phone, a.clientStatus].filter(Boolean).join(" · "),
    })),
    ...opps.map((o) => ({
      id: o.id,
      entity: "Opportunity" as const,
      title: o.name,
      subtitle: [o.stage, o.totalDebt ? `$${Number(o.totalDebt).toLocaleString()}` : null, o.oppEmail].filter(Boolean).join(" · "),
    })),
  ]) as SearchResult[];

  // Mark unused — keep `like` reserved for raw fallback if Prisma like syntax differs
  void like;

  return NextResponse.json({ results });
}
