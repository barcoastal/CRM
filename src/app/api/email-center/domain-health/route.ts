// src/app/api/email-center/domain-health/route.ts
/**
 * GET  - latest snapshot + a short history for the trend.
 * POST - "Re-check now": builds a fresh snapshot synchronously (admins only).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { buildDomainHealthSnapshot, sendingDomain } from "@/lib/email/domain-health";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const domain = sendingDomain();
  const [latest, history] = await Promise.all([
    prisma.domainHealthSnapshot.findFirst({ where: { domain }, orderBy: { createdAt: "desc" } }),
    prisma.domainHealthSnapshot.findMany({ where: { domain }, orderBy: { createdAt: "desc" }, take: 30, select: { score: true, createdAt: true } }),
  ]);
  return NextResponse.json({ domain, latest, history: history.reverse() });
}

export async function POST() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const snap = await buildDomainHealthSnapshot();
  return NextResponse.json({ ok: true, ...snap });
}
