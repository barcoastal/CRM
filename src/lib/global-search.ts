import { prisma } from "@/lib/prisma";
import { recordScope } from "@/lib/record-access";
import { hasPermission } from "@/lib/permissions";
import type { AuthedSession } from "@/lib/api-auth";
import {
  SEARCH_TYPES,
  type SearchCell,
  type SearchResponse,
  type SearchRow,
  type SearchSort,
  type SearchType,
} from "@/lib/search-types";

type Source = {
  type: SearchType;
  count: () => Promise<number>;
  rows: (skip: number, take: number) => Promise<SearchRow[]>;
};
type Input = {
  query: string;
  full?: boolean;
  type?: SearchType;
  page?: number;
  sort?: SearchSort;
};
const cell = (
  value: string | number | null | undefined,
  href?: string,
): SearchCell => ({
  text: value == null || value === "" ? "—" : String(value),
  ...(href ? { href } : {}),
});
const date = (value: Date | null) =>
  value?.toLocaleDateString("en-US", { timeZone: "UTC" });
const money = (value: number | null) =>
  value == null
    ? undefined
    : value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const label = (value: string) =>
  value.includes("_") || value === value.toUpperCase()
    ? value
        .toLowerCase()
        .replace(/(^|[ _])\w/g, (s) => s.replace("_", " ").toUpperCase())
    : value;
function row(
  type: SearchType,
  id: string,
  title: string,
  cells: SearchCell[],
): SearchRow {
  const meta = SEARCH_TYPES.find((t) => t.key === type)!;
  const href = `${meta.path}/${encodeURIComponent(id)}`;
  return {
    id,
    entity: meta.entity,
    title,
    href,
    subtitle: cells
      .map((c) => c.text)
      .filter((s) => s !== "—")
      .join(" · "),
    cells: [cell(title, href), ...cells],
  };
}
function leadField(snapshot: string | null, key: string, fallback: string) {
  try {
    const value: unknown = JSON.parse(snapshot || "{}")[key];
    return (typeof value === "string" && value !== "") ||
      typeof value === "number"
      ? String(value)
      : fallback;
  } catch {
    return fallback;
  }
}

/** Counts and rows use the same permission and record-scope predicate. */
export async function globalSearch(
  session: AuthedSession,
  input: Input,
): Promise<SearchResponse> {
  const { query: q } = input;
  const permitted = (type: SearchType) =>
    hasPermission(
      session.permissions,
      SEARCH_TYPES.find((t) => t.key === type)!.permission,
    );
  const [leadScope, oppScope, contactScope, accountScope] = await Promise.all([
    permitted("leads") ? recordScope("lead") : null,
    permitted("opportunities") ? recordScope("opportunity") : null,
    permitted("contacts") ? recordScope("contact") : null,
    permitted("accounts") ? recordScope("account") : null,
  ]);
  // LIKE metacharacters are literal search text, not wildcard commands.
  const contains = {
    contains: q.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive" as const,
  };
  const phone =
    /^[+()\d\s.-]+$/.test(q) && q.replace(/\D/g, "").length >= 4
      ? { contains: q.replace(/\D/g, "") }
      : contains;
  const direction =
    input.sort === "name-desc" ? ("desc" as const) : ("asc" as const);
  const order = (name: string) =>
    input.sort === "newest"
      ? [{ createdAt: "desc" as const }, { id: "asc" as const }]
      : [{ [name]: direction }, { id: "asc" as const }];
  const owner = { select: { name: true } } as const;
  const sources: Source[] = [];
  if (leadScope) {
    const where = {
      AND: [leadScope],
      OR: [
        { contactName: contains },
        { businessName: contains },
        { email: contains },
        { phone: contains },
        { phone },
        { sfId: q },
        { id: q },
      ],
    };
    sources.push({
      type: "leads",
      count: () => prisma.lead.count({ where }),
      rows: async (skip, take) =>
        (
          await prisma.lead.findMany({
            where,
            skip,
            take,
            orderBy: order("contactName"),
            select: {
              id: true,
              sfId: true,
              sfDataJson: true,
              contactName: true,
              businessName: true,
              phone: true,
              status: true,
              source: true,
              lastSubDisposition: true,
              assignedTo: owner,
            },
          })
        ).map((l) =>
          row(
            "leads",
            l.id,
            l.contactName || l.businessName || "Unnamed Lead",
            [
              cell(leadField(l.sfDataJson, "Lead_Id__c", l.sfId || l.id)),
              cell(l.businessName),
              cell(l.phone),
              cell(label(l.status)),
              cell(label(l.source)),
              cell(l.assignedTo?.name),
              cell(
                leadField(
                  l.sfDataJson,
                  "Sub_Disposition__c",
                  l.lastSubDisposition || "",
                ),
              ),
            ],
          ),
        ),
    });
  }
  if (oppScope) {
    const where = {
      AND: [oppScope],
      OR: [
        { name: contains },
        { oppEmail: contains },
        { oppPhone: contains },
        { oppPhone: phone },
        { sfLeadIdText: q },
        { sfId: q },
        { id: q },
      ],
    };
    sources.push({
      type: "opportunities",
      count: () => prisma.opportunity.count({ where }),
      rows: async (skip, take) =>
        (
          await prisma.opportunity.findMany({
            where,
            skip,
            take,
            orderBy: order("name"),
            select: {
              id: true,
              name: true,
              stage: true,
              totalDebt: true,
              closeDate: true,
              expectedCloseDate: true,
              sfLeadIdText: true,
              assignedTo: owner,
              account: { select: { id: true, name: true } },
            },
          })
        ).map((o) =>
          row("opportunities", o.id, o.name || "Unnamed Opportunity", [
            cell(
              o.account?.name,
              o.account && accountScope
                ? `/accounts/${o.account.id}`
                : undefined,
            ),
            cell(o.stage),
            cell(date(o.closeDate || o.expectedCloseDate)),
            cell(money(o.totalDebt)),
            cell(o.sfLeadIdText),
            cell(o.assignedTo?.name),
          ]),
        ),
    });
  }
  if (contactScope) {
    const where = {
      AND: [contactScope],
      isActive: true,
      OR: [
        { fullName: contains },
        { email: contains },
        { phone: contains },
        { phone },
        { mobilePhone: phone },
        { sfId: q },
        { id: q },
      ],
    };
    sources.push({
      type: "contacts",
      count: () => prisma.contact.count({ where }),
      rows: async (skip, take) =>
        (
          await prisma.contact.findMany({
            where,
            skip,
            take,
            orderBy: order("fullName"),
            select: {
              id: true,
              fullName: true,
              title: true,
              email: true,
              phone: true,
              owner,
              primaryAccount: { select: { id: true, name: true } },
            },
          })
        ).map((c) =>
          row("contacts", c.id, c.fullName || "Unnamed Contact", [
            cell(
              c.primaryAccount?.name,
              c.primaryAccount && accountScope
                ? `/accounts/${c.primaryAccount.id}`
                : undefined,
            ),
            cell(c.title),
            cell(c.phone),
            cell(c.email),
            cell(c.owner?.name),
          ]),
        ),
    });
  }
  if (accountScope) {
    const where = {
      AND: [accountScope],
      OR: [
        { name: contains },
        { email: contains },
        { phone: contains },
        { phone },
        { ein: contains },
        { sfId: q },
        { id: q },
      ],
    };
    sources.push({
      type: "accounts",
      count: () => prisma.account.count({ where }),
      rows: async (skip, take) =>
        (
          await prisma.account.findMany({
            where,
            skip,
            take,
            orderBy: order("name"),
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              clientStatus: true,
              brand: true,
              owner,
            },
          })
        ).map((a) =>
          row("accounts", a.id, a.name, [
            cell(a.phone),
            cell(a.email),
            cell(a.clientStatus),
            cell(a.brand),
            cell(a.owner?.name),
          ]),
        ),
    });
  }
  if (permitted("people")) {
    const where = {
      OR: [{ name: contains }, { email: contains }, { id: q }, { sfId: q }],
    };
    sources.push({
      type: "people",
      count: () => prisma.user.count({ where }),
      rows: async (skip, take) =>
        (
          await prisma.user.findMany({
            where,
            skip,
            take,
            orderBy: order("name"),
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
            },
          })
        ).map((u) =>
          row("people", u.id, u.name, [
            cell(u.email),
            cell(label(u.role)),
            cell(u.isActive ? "Active" : "Inactive"),
          ]),
        ),
    });
  }
  // These objects use the same object-level visibility as their list APIs.
  if (permitted("cases")) {
    const where = {
      OR: [
        { subject: contains },
        { caseNumber: contains },
        { sfId: q },
        { id: q },
      ],
    };
    sources.push({
      type: "cases",
      count: () => prisma.case.count({ where }),
      rows: async (skip, take) =>
        (
          await prisma.case.findMany({
            where,
            skip,
            take,
            orderBy: order("subject"),
            select: {
              id: true,
              subject: true,
              caseNumber: true,
              status: true,
              priority: true,
              owner,
            },
          })
        ).map((c) =>
          row("cases", c.id, c.subject, [
            cell(c.caseNumber),
            cell(label(c.status)),
            cell(label(c.priority)),
            cell(c.owner?.name),
          ]),
        ),
    });
  }
  if (permitted("tasks")) {
    const where = {
      type: "TASK",
      OR: [{ subject: contains }, { sfId: q }, { id: q }],
    };
    sources.push({
      type: "tasks",
      count: () => prisma.task.count({ where }),
      rows: async (skip, take) =>
        (
          await prisma.task.findMany({
            where,
            skip,
            take,
            orderBy: order("subject"),
            select: {
              id: true,
              subject: true,
              status: true,
              priority: true,
              dueDate: true,
              owner,
            },
          })
        ).map((t) =>
          row("tasks", t.id, t.subject, [
            cell(label(t.status)),
            cell(label(t.priority)),
            cell(date(t.dueDate)),
            cell(t.owner?.name),
          ]),
        ),
    });
  }
  if (!input.full) {
    const groups = await Promise.all(
      sources.map(async (source) => ({
        type: source.type,
        count: 0,
        page: 1,
        pageSize: 5,
        rows: await source.rows(0, 5),
      })),
    );
    return {
      query: q,
      total: groups.reduce((n, g) => n + g.rows.length, 0),
      groups,
    };
  }
  const counts = await Promise.all(sources.map((s) => s.count()));
  const groups = await Promise.all(
    sources.map(async (source, i) => {
      const pageSize = input.type ? 25 : 5;
      const page =
        input.type === source.type
          ? Math.min(
              input.page || 1,
              Math.max(1, Math.ceil(counts[i] / pageSize)),
            )
          : 1;
      const visible = !input.type || input.type === source.type;
      return {
        type: source.type,
        count: counts[i],
        page,
        pageSize,
        rows:
          visible && counts[i]
            ? await source.rows((page - 1) * pageSize, pageSize)
            : [],
      };
    }),
  );
  return { query: q, total: counts.reduce((a, b) => a + b, 0), groups };
}
