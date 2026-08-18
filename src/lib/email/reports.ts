// src/lib/email/reports.ts
/**
 * Pure analytics for the Email Center reports. All rates are percentages
 * rounded to one decimal. Denominators follow email-industry convention:
 * open/click/unsubscribe rates are over DELIVERED, delivery/bounce over TOTAL.
 */

export interface MessageAgg {
  total: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
}

export interface Rates {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function computeRates(a: MessageAgg): Rates {
  return {
    deliveryRate: pct(a.delivered, a.total),
    openRate: pct(a.uniqueOpens, a.delivered),
    clickRate: pct(a.uniqueClicks, a.delivered),
    clickToOpenRate: pct(a.uniqueClicks, a.uniqueOpens),
    bounceRate: pct(a.bounced, a.total),
    complaintRate: pct(a.complained, a.total),
    unsubscribeRate: pct(a.unsubscribed, a.delivered),
  };
}

export function bucketByDay(rows: Array<{ occurredAt: Date }>): Array<{ day: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const day = r.occurredAt.toISOString().slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));
}

export function topUrls(rows: Array<{ url: string | null }>, limit: number): Array<{ url: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.url) continue;
    map.set(r.url, (map.get(r.url) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([url, count]) => ({ url, count }));
}
