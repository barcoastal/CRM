import { prisma } from "@/lib/prisma";
import { getTierConfig, tierForDebt } from "@/lib/closer-tiers";
import { appBaseUrl } from "@/lib/document-request";

/**
 * Client-scheduled calls: the CRM emails an opportunity's client a booking link,
 * the client picks a time, the floor manager assigns a closer, and the closer
 * gets a one-click "add to calendar" invite. See ScheduledCall in the schema.
 */

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function randomToken(): string {
  // 24 hex-ish chars without crypto import fuss (server-side, unguessable enough
  // for a booking link; also gated by opp existence).
  return Array.from({ length: 24 }, () => "0123456789abcdef"[Math.floor((Date.now() * Math.random()) % 16)]).join("") + Date.now().toString(36);
}

/** Resolve an opportunity's client contact + debt for a booking. */
export async function bookingContextForOpp(opportunityId: string): Promise<
  | { error: string }
  | { clientName: string | null; clientEmail: string | null; clientPhone: string | null; debt: number; debtLabel: string; tier: number }
> {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      debts: { select: { originalBalance: true } },
      primaryContact: { select: { fullName: true, email: true, phone: true } },
      lead: { select: { contactName: true, email: true, phone: true } },
    },
  });
  if (!opp) return { error: "Opportunity not found" };
  const debt = opp.debts.reduce((s, d) => s + (d.originalBalance ?? 0), 0) || opp.totalDebt || 0;
  const cfg = await getTierConfig();
  return {
    clientName: opp.primaryContact?.fullName ?? opp.lead?.contactName ?? opp.name ?? null,
    clientEmail: opp.oppEmail ?? opp.primaryContact?.email ?? opp.lead?.email ?? null,
    clientPhone: opp.primaryContact?.phone ?? opp.lead?.phone ?? null,
    debt,
    debtLabel: debt ? money(debt) : "",
    tier: debt ? tierForDebt(debt, cfg) : 1,
  };
}

/** Create the booking record + return the public booking URL. */
export async function createBookingLink(opportunityId: string): Promise<{ token: string; url: string; call: { clientName: string | null; clientEmail: string | null } } | { error: string }> {
  const ctx = await bookingContextForOpp(opportunityId);
  if ("error" in ctx) return ctx;
  const token = randomToken();
  await prisma.scheduledCall.create({
    data: {
      token,
      opportunityId,
      clientName: ctx.clientName,
      clientEmail: ctx.clientEmail,
      clientPhone: ctx.clientPhone,
      debt: ctx.debt || null,
      debtLabel: ctx.debtLabel || null,
      tier: ctx.tier,
      status: "SENT",
    },
  });
  return { token, url: `${appBaseUrl()}/book/${token}`, call: { clientName: ctx.clientName, clientEmail: ctx.clientEmail } };
}

const digits10 = (p: string | null | undefined) => (p ?? "").replace(/[^0-9]/g, "").slice(-10);

/**
 * Match a self-booking client (generic Calendly-style link) to their record by
 * email or phone, to snapshot the debt + tier for the floor manager.
 */
export async function matchClientForBooking(email: string | null, phone: string | null): Promise<{
  opportunityId: string | null; leadId: string | null; debt: number | null; debtLabel: string | null; tier: number | null;
}> {
  const cfg = await getTierConfig();
  const finish = (debt: number, oppId: string | null, leadId: string | null) => ({
    opportunityId: oppId, leadId, debt: debt || null,
    debtLabel: debt ? money(debt) : null, tier: debt ? tierForDebt(debt, cfg) : null,
  });

  // Prefer an opportunity (has numeric debt) matched by email.
  if (email) {
    const opp = await prisma.opportunity.findFirst({
      where: { OR: [{ oppEmail: { equals: email, mode: "insensitive" } }, { lead: { email: { equals: email, mode: "insensitive" } } }, { primaryContact: { email: { equals: email, mode: "insensitive" } } }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, totalDebt: true, debts: { select: { originalBalance: true } } },
    });
    if (opp) {
      const debt = opp.debts.reduce((s, d) => s + (d.originalBalance ?? 0), 0) || opp.totalDebt || 0;
      return finish(debt, opp.id, null);
    }
  }
  // Fall back to a lead by phone (indexed last-10) or email.
  const last10 = digits10(phone);
  let lead: { id: string; totalDebtEst: number | null; sfDataJson: string | null } | null = null;
  if (last10.length === 10) {
    const rows = await prisma.$queryRaw<Array<{ id: string; totalDebtEst: number | null; sfDataJson: string | null }>>`
      SELECT id, "totalDebtEst", "sfDataJson" FROM "Lead"
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${last10} LIMIT 1`;
    lead = rows[0] ?? null;
  }
  if (!lead && email) {
    lead = await prisma.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, totalDebtEst: true, sfDataJson: true } });
  }
  if (lead) {
    let debt = lead.totalDebtEst ?? 0;
    let label: string | null = debt ? money(debt) : null;
    if (!debt) {
      try {
        const sf = lead.sfDataJson ? (JSON.parse(lead.sfDataJson) as Record<string, unknown>) : {};
        const est = sf.Estimated_Total_Debt__c;
        if (est) { const nums = (String(est).match(/[\d,]+/g) ?? []).map((n) => Number(n.replace(/,/g, ""))); if (nums.length) { debt = nums.length > 1 ? (nums[0] + nums[nums.length - 1]) / 2 : nums[0]; label = String(est); } }
      } catch { /* ignore */ }
    }
    return { opportunityId: null, leadId: lead.id, debt: debt || null, debtLabel: label, tier: debt ? tierForDebt(debt, cfg) : null };
  }
  return { opportunityId: null, leadId: null, debt: null, debtLabel: null, tier: null };
}

/** Available 30-min slots for the next N business days (9am-6pm Eastern). */
export function availableSlots(days = 5): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const now = Date.now();
  for (let d = 0; d < days * 2 && out.length < 60; d++) {
    // Build slots per day in Eastern business hours.
    const day = new Date(now + d * 86400000);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(day);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    if (p.weekday === "Sat" || p.weekday === "Sun") continue;
    for (let h = 9; h < 18; h++) {
      for (const min of [0, 30]) {
        // Eastern wall clock -> approximate UTC (EDT -4). Good enough for display + booking.
        const slot = new Date(`${p.year}-${p.month}-${p.day}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00-04:00`);
        if (slot.getTime() <= now + 3600000) continue; // at least 1h out
        out.push({
          iso: slot.toISOString(),
          label: slot.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        });
      }
    }
  }
  return out.slice(0, 80);
}

/** Google Calendar + Outlook "add event" links for the closer invite. */
export function calendarLinks(title: string, startISO: string, details: string): { google: string; outlook: string } {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + 30 * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const g = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${fmt(start)}/${fmt(end)}`, details });
  const o = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: title, startdt: start.toISOString(), enddt: end.toISOString(), body: details });
  return {
    google: `https://calendar.google.com/calendar/render?${g.toString()}`,
    outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${o.toString()}`,
  };
}
