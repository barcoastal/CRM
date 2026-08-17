/**
 * Multi-source campaign audiences. A campaign's audience is a union of
 * sources (saved Segments, ListViews, dialer Campaign members) resolved to
 * Recipient rows and deduped by email (first source wins).
 */
import { prisma } from "@/lib/prisma";
import { buildWhere, type ListFilter } from "@/lib/list-views";

export interface AudienceSource {
  type: "segment" | "listview" | "campaign";
  id: string;
}

/** Minimal recipient shape shared with mass-sender (structurally compatible). */
export interface AudienceRecipient {
  entityType: "Lead" | "Contact";
  id: string;
  email: string;
  vars: Record<string, string | number | null>;
  leadId?: string;
  contactId?: string;
  accountId?: string;
}

const SOURCE_TYPES = new Set(["segment", "listview", "campaign"]);

export function parseSources(raw: unknown): AudienceSource[] {
  if (!Array.isArray(raw)) return [];
  const out: AudienceSource[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      SOURCE_TYPES.has(String((item as { type?: unknown }).type)) &&
      typeof (item as { id?: unknown }).id === "string" &&
      (item as { id: string }).id
    ) {
      out.push({ type: (item as { type: AudienceSource["type"] }).type, id: (item as { id: string }).id });
    }
  }
  return out;
}

export function dedupeByEmail<T extends { email: string }>(recipients: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of recipients) {
    const key = r.email.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

type IdLoader = {
  leads: (ids: string[]) => Promise<AudienceRecipient[]>;
  contacts: (ids: string[]) => Promise<AudienceRecipient[]>;
};

/** Resolve one source to entity ids grouped by entity type. */
async function sourceIds(source: AudienceSource): Promise<{ entity: "Lead" | "Contact"; ids: string[] } | null> {
  if (source.type === "segment") {
    const seg = await prisma.segment.findUnique({ where: { id: source.id } });
    if (!seg) return null;
    const entity = seg.entity === "Contact" ? "Contact" : "Lead";
    const where = { email: { not: null }, ...buildWhere((seg.filters as unknown as ListFilter[]) ?? []) };
    const delegate = entity === "Lead" ? prisma.lead : prisma.contact;
    const rows = await (delegate as unknown as { findMany: (a: object) => Promise<Array<{ id: string }>> }).findMany({
      where,
      select: { id: true },
      take: 10000,
    });
    return { entity, ids: rows.map((r) => r.id) };
  }
  if (source.type === "listview") {
    const view = await prisma.listView.findUnique({ where: { id: source.id } });
    if (!view) return null;
    const entity = view.entity === "Contact" ? "Contact" : view.entity === "Lead" ? "Lead" : null;
    if (!entity) return null; // campaigns only mail leads/contacts
    const where = { email: { not: null }, ...buildWhere((view.filters as unknown as ListFilter[]) ?? []) };
    const delegate = entity === "Lead" ? prisma.lead : prisma.contact;
    const rows = await (delegate as unknown as { findMany: (a: object) => Promise<Array<{ id: string }>> }).findMany({
      where,
      select: { id: true },
      take: 10000,
    });
    return { entity, ids: rows.map((r) => r.id) };
  }
  // dialer campaign members are leads
  const members = await prisma.campaignContact.findMany({
    where: { campaignId: source.id },
    select: { leadId: true },
    take: 10000,
  });
  return { entity: "Lead", ids: members.map((m) => m.leadId) };
}

/**
 * Resolve all sources to full recipients, deduped by email. Loaders are
 * injected by mass-sender so its Recipient var-building stays in one place.
 */
export async function resolveSourcesAudience(
  rawSources: unknown,
  load: IdLoader,
): Promise<AudienceRecipient[]> {
  const sources = parseSources(rawSources);
  const all: AudienceRecipient[] = [];
  for (const source of sources) {
    const resolved = await sourceIds(source);
    if (!resolved || resolved.ids.length === 0) continue;
    const recipients =
      resolved.entity === "Lead" ? await load.leads(resolved.ids) : await load.contacts(resolved.ids);
    all.push(...recipients);
  }
  return dedupeByEmail(all);
}

/** Count preview for the campaign builder: resolves ids only, dedupe not applied (fast). */
export async function countSourcesAudience(rawSources: unknown): Promise<{ total: number; perSource: Array<{ type: string; id: string; count: number }> }> {
  const sources = parseSources(rawSources);
  const perSource: Array<{ type: string; id: string; count: number }> = [];
  let total = 0;
  for (const source of sources) {
    const resolved = await sourceIds(source);
    const count = resolved?.ids.length ?? 0;
    perSource.push({ type: source.type, id: source.id, count });
    total += count;
  }
  return { total, perSource };
}
