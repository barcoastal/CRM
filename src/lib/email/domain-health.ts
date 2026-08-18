// src/lib/email/domain-health.ts
/**
 * Builds a DomainHealthSnapshot: runs the DNS/DNSBL checks, computes reputation
 * from the trailing 30 days of sends for the domain, scores it, and persists a
 * row. Callers: the cron (daily) and the "Re-check now" button.
 */
import { prisma } from "@/lib/prisma";
import { checkSpf, checkDkim, checkDmarc, checkBlacklists } from "./domain-dns";
import { healthScore, type ScoreInput } from "./domain-reputation";

/** The sending domain, from EMAIL_FROM (e.g. "Coastal Debt <no-reply@coastaldebt.com>" -> coastaldebt.com). */
export function sendingDomain(): string {
  const from = process.env.EMAIL_FROM ?? "no-reply@coastaldebt.com";
  const m = /@([a-z0-9.-]+)/i.exec(from);
  return (m?.[1] ?? "coastaldebt.com").toLowerCase();
}

export async function buildDomainHealthSnapshot(): Promise<{ id: string; score: number }> {
  const domain = sendingDomain();
  const since = new Date(Date.now() - 30 * 864e5);

  const [spf, dkim, dmarc, blacklists, total, bounced, complained, delivered, opened] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain),
    checkDmarc(domain),
    checkBlacklists(process.env.SENDING_IP ?? null),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since } } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, status: "BOUNCED" } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, status: "COMPLAINED" } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, deliveredAt: { not: null } } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, openedAt: { not: null } } }),
  ]);

  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  const bounceRate = pct(bounced, total);
  const complaintRate = pct(complained, total);
  const openRate = pct(opened, delivered);
  const listedCount = blacklists.filter((b) => b.listed).length;

  const scoreInput: ScoreInput = {
    spf: spf.status, dkim: dkim.status, dmarc: dmarc.status,
    bounceRate, complaintRate, openRate, blacklisted: listedCount,
  };
  const score = healthScore(scoreInput);

  const snap = await prisma.domainHealthSnapshot.create({
    data: {
      domain,
      spf: spf.status, dkim: dkim.status, dmarc: dmarc.status,
      spfRecord: spf.record ?? null, dmarcRecord: dmarc.record ?? null,
      bounceRate, complaintRate, openRate, score,
      blacklists: blacklists as unknown as object,
    },
    select: { id: true, score: true },
  });
  return snap;
}
