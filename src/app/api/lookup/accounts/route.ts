/**
 * Lightweight account lookup for inline lookup editors (e.g. changing the
 * Account on an Opportunity). Returns { id, label } options matching ?q=.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Account.Read");
  if ("response" in r) return r.response;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ options: [] });

  const accounts = await prisma.account.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, recordType: true, billingCity: true, billingState: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  return NextResponse.json({
    options: accounts.map((a) => ({
      id: a.id,
      label: a.name,
      sublabel: [a.recordType.replace(/_/g, " "), [a.billingCity, a.billingState].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    })),
  });
}
