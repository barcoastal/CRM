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

/** Currently-OPEN (Five9 READY) closers grouped by tier, for the dialer window. */
export async function availableClosers(): Promise<{ tier: number; closers: string[] }[]> {
  const closers = await prisma.user.findMany({
    where: { isActive: true, closerTier: { not: null } },
    select: { name: true, closerTier: true, five9Username: true, email: true },
  });
  const free = closers
    .filter((u) => simplifyState(supervisorFeed.getStateFor(u.five9Username ?? u.email, u.name)?.state ?? null) === "READY")
    .map((u) => ({ name: u.name, tier: u.closerTier as number }));
  return [3, 2, 1].map((tier) => ({
    tier,
    closers: free.filter((c) => c.tier === tier).map((c) => c.name).sort((a, b) => a.localeCompare(b)),
  }));
}

export interface CloserStat {
  id: string;
  name: string;
  tier: number | null;
  state: CloserState;
  free: boolean;
  callsTaken: number; // handoffs assigned to this closer
  debtAttempted: number; // sum of debt on assigned handoffs
  closedCount: number; // handoffs marked CLOSED
  debtClosed: number; // sum of closedDebt
}

/** Per-closer production stats for the floor manager (from CloserHandoff) + live state. */
export async function closerStats(): Promise<CloserStat[]> {
  const closers = await prisma.user.findMany({
    where: { isActive: true, closerTier: { not: null } },
    select: { id: true, name: true, closerTier: true, five9Username: true, email: true },
  });
  const ids = closers.map((c) => c.id);
  if (ids.length === 0) return [];

  const [assigned, closed] = await Promise.all([
    prisma.closerHandoff.groupBy({ by: ["closerId"], where: { closerId: { in: ids } }, _count: { _all: true }, _sum: { debt: true } }),
    prisma.closerHandoff.groupBy({ by: ["closerId"], where: { closerId: { in: ids }, status: "CLOSED" }, _count: { _all: true }, _sum: { closedDebt: true } }),
  ]);
  const aBy = new Map(assigned.map((a) => [a.closerId, { c: a._count._all, d: a._sum.debt ?? 0 }]));
  const cBy = new Map(closed.map((x) => [x.closerId, { c: x._count._all, d: x._sum.closedDebt ?? 0 }]));

  return closers
    .map((u) => {
      const state = simplifyState(supervisorFeed.getStateFor(u.five9Username ?? u.email, u.name)?.state ?? null);
      const a = aBy.get(u.id);
      const cl = cBy.get(u.id);
      return {
        id: u.id,
        name: u.name,
        tier: u.closerTier,
        state,
        free: state === "READY",
        callsTaken: a?.c ?? 0,
        debtAttempted: a?.d ?? 0,
        closedCount: cl?.c ?? 0,
        debtClosed: cl?.d ?? 0,
      };
    })
    .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || b.closedCount - a.closedCount || a.name.localeCompare(b.name));
}

export interface DashboardTransfer {
  id: string;
  at: string;
  clientName: string | null;
  debt: number | null;
  debtLabel: string | null;
  tier: number | null;
  status: string;
}
export interface CloserDashboardRow {
  id: string;
  name: string;
  tier: number | null;
  todayCount: number;
  todayDebt: number;
  monthCount: number;
  monthDebt: number;
  transfers: DashboardTransfer[]; // this month's transfers, newest first
}

/**
 * Admin closer dashboard: per closer, how many transfer calls they got today
 * and this month, and the debt of each - sourced from the real opportunities
 * assigned to them (assignedToId = the closer, verified vs CloserLookup__c).
 * `now` is injected so the caller controls the clock.
 */
export async function closerDashboard(now: number): Promise<CloserDashboardRow[]> {
  const closers = await prisma.user.findMany({
    where: { isActive: true, closerTier: { not: null } },
    select: { id: true, name: true, closerTier: true },
  });
  const ids = closers.map((c) => c.id);
  if (ids.length === 0) return [];

  // Day/month boundaries in the business timezone (US Eastern), not the server's
  // UTC - otherwise late-evening activity bleeds into the next "day".
  const { startOfToday, startOfMonth } = easternBoundaries(now);

  // Every opportunity (= a transferred call) assigned to a tiered closer this month.
  const opps = await prisma.opportunity.findMany({
    where: { assignedToId: { in: ids }, createdAt: { gte: startOfMonth } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, assignedToId: true, totalDebt: true, createdAt: true, stage: true },
  });

  const byCloser = new Map<string, typeof opps>();
  for (const o of opps) {
    if (!o.assignedToId) continue;
    const arr = byCloser.get(o.assignedToId) ?? [];
    arr.push(o);
    byCloser.set(o.assignedToId, arr);
  }
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

  return closers
    .map((u) => {
      const rows = byCloser.get(u.id) ?? [];
      const today = rows.filter((o) => o.createdAt >= startOfToday);
      const sum = (rs: typeof rows) => rs.reduce((s, o) => s + (o.totalDebt ?? 0), 0);
      return {
        id: u.id,
        name: u.name,
        tier: u.closerTier,
        todayCount: today.length,
        todayDebt: sum(today),
        monthCount: rows.length,
        monthDebt: sum(rows),
        transfers: rows.map((o) => ({
          id: o.id,
          at: o.createdAt.toISOString(),
          clientName: o.name,
          debt: o.totalDebt,
          debtLabel: o.totalDebt ? money(o.totalDebt) : null,
          tier: u.closerTier,
          status: o.stage,
        })),
      };
    })
    .sort((a, b) => b.monthDebt - a.monthDebt || b.monthCount - a.monthCount || a.name.localeCompare(b.name));
}

export interface OnCallCloser {
  id: string;
  name: string;
  tier: number | null;
  durationSec: number;
  clientName: string | null;
  clientDebt: number | null; // numeric (for sorting)
  clientDebtLabel: string | null; // display (money or the range string the client picked)
  eligibleTier: number | null; // tier the client's debt qualifies for (for assignment)
  leadId: string | null;
}

const digits10 = (p: string | null | undefined) => (p ?? "").replace(/[^0-9]/g, "").slice(-10);
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Start-of-today and start-of-month as UTC instants, computed in the business
 * timezone (US Eastern). Avoids counting late-evening activity as the next day.
 */
export function easternBoundaries(now: number): { startOfToday: Date; startOfMonth: Date } {
  const d = new Date(now);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const h = Number(parts.hour) % 24;
  const elapsedMs = ((h * 3600) + Number(parts.minute) * 60 + Number(parts.second)) * 1000 + d.getMilliseconds();
  const startOfToday = new Date(d.getTime() - elapsedMs);
  const startOfMonth = new Date(startOfToday.getTime() - (Number(parts.day) - 1) * 86_400_000);
  return { startOfToday, startOfMonth };
}

/** Resolve the client a closer is talking to (by Five9 "customer") + their debt. */
async function clientForCustomer(
  customer: string | null,
): Promise<{ leadId: string | null; name: string | null; debt: number | null; debtLabel: string | null }> {
  if (!customer) return { leadId: null, name: null, debt: null, debtLabel: null };
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
  if (!lead) return { leadId: null, name: customer, debt: null, debtLabel: null };

  const agg = await prisma.leadDebt.aggregate({ where: { leadId: lead.id }, _sum: { amount: true } });
  let debt = agg._sum.amount ?? 0;
  if (!debt) debt = lead.totalDebtEst ?? 0;
  let debtLabel = debt ? money(debt) : null;

  // Web leads store debt as a range picklist ("$100,000 - $500,000") in
  // Estimated_Total_Debt__c, not a number. Show the range; use its midpoint for
  // sorting/tiering.
  if (!debt) {
    try {
      const sf = lead.sfDataJson ? (JSON.parse(lead.sfDataJson) as Record<string, unknown>) : {};
      const est = sf.Estimated_Total_Debt__c ?? sf.Total_Debt_Amount__c;
      if (est != null && String(est).trim()) {
        const raw = String(est).trim();
        const nums = (raw.match(/[\d,.]+/g) ?? []).map((n) => Number(n.replace(/,/g, ""))).filter((n) => n > 0);
        if (nums.length) {
          debt = nums.length > 1 ? (nums[0] + nums[nums.length - 1]) / 2 : nums[0];
          debtLabel = /[-–]|to/i.test(raw) ? raw : money(nums[0]);
        }
      }
    } catch { /* ignore */ }
  }
  return { leadId: lead.id, name: lead.contactName || lead.businessName || customer, debt: debt || null, debtLabel };
}

/** Every agent currently ON a call, with the client + debt, tier badged if set. */
export async function closersOnCall(now = Date.now()): Promise<OnCallCloser[]> {
  const calls = supervisorFeed.liveCalls(now);
  if (calls.length === 0) return [];

  const cfg = await getTierConfig();

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
      clientDebtLabel: client.debtLabel,
      eligibleTier: client.debt != null ? tierForDebt(client.debt, cfg) : null,
      leadId: client.leadId,
    });
  }
  return out.sort((a, b) => (b.clientDebt ?? 0) - (a.clientDebt ?? 0));
}
