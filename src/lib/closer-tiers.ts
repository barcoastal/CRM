import { prisma } from "@/lib/prisma";
import { supervisorFeed } from "@/lib/five9/supervisor-feed";

/**
 * Closer-tier transfer routing. A deal's debt maps to a preferred tier
 * (1/2/3, higher = bigger deals). When a fronter wants to transfer, we surface
 * the closers in the preferred tier who are free (Five9 READY), then fall back
 * to the nearest other tiers so the call is never lost.
 */

export interface TierConfig {
  tier1Max: number;
  tier2Max: number;
}

const DEFAULT_CONFIG: TierConfig = { tier1Max: 100_000, tier2Max: 250_000 };

export async function getTierConfig(): Promise<TierConfig> {
  const row = await prisma.closerTierConfig.findUnique({ where: { id: "singleton" } });
  return row ? { tier1Max: row.tier1Max, tier2Max: row.tier2Max } : DEFAULT_CONFIG;
}

/** Preferred tier for a debt amount. */
export function tierForDebt(debt: number, cfg: TierConfig): 1 | 2 | 3 {
  if (debt >= cfg.tier2Max) return 3;
  if (debt >= cfg.tier1Max) return 2;
  return 1;
}

/**
 * Order tiers to try: preferred first, then the rest by closeness to it
 * (ties broken toward the more senior tier). So a $300K deal tries 3 → 2 → 1,
 * a $50K deal tries 1 → 2 → 3.
 */
export function tierFallbackOrder(preferred: 1 | 2 | 3): number[] {
  return [1, 2, 3].sort((a, b) => {
    const da = Math.abs(a - preferred);
    const db = Math.abs(b - preferred);
    return da === db ? b - a : da - db;
  });
}

export type CloserState = "READY" | "ON_CALL" | "NOT_READY" | "OFFLINE";

export interface CloserAvailability {
  id: string;
  name: string;
  tier: number;
  state: CloserState;
  free: boolean;
  onCallSince: number | null;
}

/** Map a raw Five9 state string to our simplified availability. */
function simplifyState(raw: string | null): CloserState {
  if (!raw) return "OFFLINE";
  if (raw === "READY") return "READY";
  if (raw === "ON_CALL") return "ON_CALL";
  if (raw === "LOGGED_OUT") return "OFFLINE";
  return "NOT_READY"; // NOT_READY, ACW, etc.
}

/** All tiered closers with their live availability, grouped for a given debt. */
export async function transferTargetsForDebt(debt: number): Promise<{
  debt: number;
  preferredTier: 1 | 2 | 3;
  tierOrder: number[];
  config: TierConfig;
  tiers: { tier: number; preferred: boolean; closers: CloserAvailability[] }[];
}> {
  const config = await getTierConfig();
  const preferredTier = tierForDebt(debt, config);
  const tierOrder = tierFallbackOrder(preferredTier);

  const closers = await prisma.user.findMany({
    where: { isCloser: true, isActive: true, closerTier: { not: null } },
    select: { id: true, name: true, closerTier: true, five9Username: true, email: true },
  });

  const withState: CloserAvailability[] = closers.map((u) => {
    const s = supervisorFeed.getStateFor(u.five9Username ?? u.email, u.name);
    const state = simplifyState(s?.state ?? null);
    return {
      id: u.id,
      name: u.name,
      tier: u.closerTier as number,
      state,
      free: state === "READY",
      onCallSince: s?.onCallSince ?? null,
    };
  });

  const tiers = tierOrder.map((tier) => ({
    tier,
    preferred: tier === preferredTier,
    // free closers first, then by name
    closers: withState
      .filter((c) => c.tier === tier)
      .sort((a, b) => (a.free === b.free ? a.name.localeCompare(b.name) : a.free ? -1 : 1)),
  }));

  return { debt, preferredTier, tierOrder, config, tiers };
}

export interface ScoreboardRow {
  id: string;
  name: string;
  tier: number | null;
  state: CloserState;
  free: boolean;
  assignedCount: number;
  wonCount: number;
  wonDebt: number;
}

/** Leaderboard of every closer: production (assigned + won opps) + live state. */
export async function closerScoreboard(): Promise<ScoreboardRow[]> {
  const closers = await prisma.user.findMany({
    where: { isActive: true, OR: [{ isCloser: true }, { closerTier: { not: null } }] },
    select: { id: true, name: true, closerTier: true, five9Username: true, email: true },
  });
  const ids = closers.map((c) => c.id);
  if (ids.length === 0) return [];

  const [assigned, won] = await Promise.all([
    prisma.opportunity.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.opportunity.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { in: ids }, stage: { contains: "Closed Won" } },
      _count: { _all: true },
      _sum: { totalDebt: true },
    }),
  ]);
  const assignedBy = new Map(assigned.map((a) => [a.assignedToId, a._count._all]));
  const wonBy = new Map(won.map((w) => [w.assignedToId, { c: w._count._all, d: w._sum.totalDebt ?? 0 }]));

  return closers
    .map((u) => {
      const s = supervisorFeed.getStateFor(u.five9Username ?? u.email, u.name);
      const state = simplifyState(s?.state ?? null);
      const w = wonBy.get(u.id);
      return {
        id: u.id,
        name: u.name,
        tier: u.closerTier,
        state,
        free: state === "READY",
        assignedCount: assignedBy.get(u.id) ?? 0,
        wonCount: w?.c ?? 0,
        wonDebt: w?.d ?? 0,
      };
    })
    .sort((a, b) => b.wonCount - a.wonCount || b.wonDebt - a.wonDebt || a.name.localeCompare(b.name));
}

export interface OnCallCloser {
  id: string;
  name: string;
  tier: number | null;
  durationSec: number;
  clientName: string | null;
  clientDebt: number | null;
  leadId: string | null;
}

const digits10 = (p: string | null | undefined) => (p ?? "").replace(/[^0-9]/g, "").slice(-10);

/** Resolve the client a closer is talking to (by Five9 "customer") + their debt. */
async function clientForCustomer(
  customer: string | null,
): Promise<{ leadId: string | null; name: string | null; debt: number | null }> {
  if (!customer) return { leadId: null, name: null, debt: null };
  // Strip non-printable/encoding junk Five9 sometimes appends.
  const trimmed = customer.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  const sel = { id: true, contactName: true, businessName: true, totalDebtEst: true, sfDataJson: true } as const;
  type L = { id: string; contactName: string | null; businessName: string | null; totalDebtEst: number | null; sfDataJson: string | null };

  let lead: L | null = null;
  const last10 = digits10(trimmed);
  if (/\d/.test(trimmed) && last10.length >= 7) {
    const rows = await prisma.$queryRaw<L[]>`
      SELECT id, "contactName", "businessName", "totalDebtEst", "sfDataJson" FROM "Lead"
      WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${"%" + last10}
      LIMIT 1`;
    lead = rows[0] ?? null;
  }
  if (!lead) {
    // Five9 customer is often "Last, First - Business Name". Try the business
    // part against businessName, then the person part against contactName.
    const [personRaw, ...bizParts] = trimmed.split(" - ");
    const business = bizParts.join(" - ").trim();
    const person = personRaw.includes(",")
      ? personRaw.split(",").map((s) => s.trim()).reverse().join(" ")
      : personRaw.trim();
    if (business) {
      lead = await prisma.lead.findFirst({ where: { businessName: { equals: business, mode: "insensitive" } }, select: sel });
    }
    if (!lead && person) {
      lead = await prisma.lead.findFirst({ where: { contactName: { contains: person, mode: "insensitive" } }, select: sel });
    }
  }
  if (!lead) return { leadId: null, name: customer, debt: null };

  const agg = await prisma.leadDebt.aggregate({ where: { leadId: lead.id }, _sum: { amount: true } });
  let debt = agg._sum.amount ?? 0;
  if (!debt) debt = lead.totalDebtEst ?? 0;
  if (!debt) {
    try {
      const sf = lead.sfDataJson ? (JSON.parse(lead.sfDataJson) as Record<string, unknown>) : {};
      debt = Number(sf.Estimated_Total_Debt__c ?? sf.Total_Debt_Amount__c ?? 0) || 0;
    } catch { /* ignore */ }
  }
  return { leadId: lead.id, name: lead.contactName || lead.businessName || customer, debt: debt || null };
}

/** Every agent currently ON a call, with the client + debt, tier badged if set. */
export async function closersOnCall(now = Date.now()): Promise<OnCallCloser[]> {
  const calls = supervisorFeed.liveCalls(now);
  if (calls.length === 0) return [];

  // Map Five9 login (username/email) -> CRM user (for display name + tier).
  const users = await prisma.user.findMany({
    select: { id: true, name: true, closerTier: true, five9Username: true, email: true },
  });
  const byLogin = new Map<string, { id: string; name: string; tier: number | null }>();
  for (const u of users) {
    const rec = { id: u.id, name: u.name, tier: u.closerTier };
    if (u.email) byLogin.set(u.email.toLowerCase(), rec);
    if (u.five9Username) byLogin.set(u.five9Username.toLowerCase(), rec);
  }

  const out: OnCallCloser[] = [];
  for (const c of calls) {
    const user = c.username ? byLogin.get(c.username.toLowerCase()) : undefined;
    const client = await clientForCustomer(c.customer);
    out.push({
      id: user?.id ?? c.five9UserId,
      name: user?.name ?? c.username ?? "Unknown agent",
      tier: user?.tier ?? null,
      durationSec: c.durationSec ?? (c.onCallSince ? Math.max(0, Math.floor((now - c.onCallSince) / 1000)) : 0),
      clientName: client.name,
      clientDebt: client.debt,
      leadId: client.leadId,
    });
  }
  return out.sort((a, b) => (b.clientDebt ?? 0) - (a.clientDebt ?? 0));
}
