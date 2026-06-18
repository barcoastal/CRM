/**
 * List view filter primitives. Mirrors a tiny subset of Salesforce list-view
 * filtering: each filter is { field, op, value }; logic AND across all.
 */

export type FilterOp =
  | "EQ"
  | "NEQ"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "STARTS_WITH"
  | "IN"
  | "NOT_IN"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "IS_NULL"
  | "IS_NOT_NULL"
  | "OR"; // value is ListFilter[] — OR'd together (for SF custom filter logic)

export interface ListFilter {
  field: string;
  op: FilterOp;
  value?: unknown;
}

/**
 * Pure: turn an array of ListFilter into a Prisma where-clause subtree.
 * Caller spreads this into the entity-specific where (e.g. { isActive: true, ...buildWhere(filters) }).
 *
 * Unknown ops fall through to no-op.
 */
export function buildWhere(filters: readonly ListFilter[]): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const f of filters) {
    // OR group: { op: "OR", value: ListFilter[] } -> Prisma OR over the sub-filters.
    if (f.op === "OR" && Array.isArray(f.value)) {
      const ors = (f.value as ListFilter[])
        .map((sub) => {
          const node = filterToPrisma(sub);
          return node === undefined ? null : { [sub.field]: node };
        })
        .filter(Boolean);
      if (ors.length) where.OR = ([] as unknown[]).concat((where.OR as unknown[]) ?? [], ors);
      continue;
    }
    const node = filterToPrisma(f);
    if (node === undefined) continue; // IS_NULL legitimately returns null
    where[f.field] = node;
  }
  return where;
}

function filterToPrisma(f: ListFilter): unknown {
  switch (f.op) {
    case "EQ": return f.value;
    case "NEQ": return { not: f.value };
    case "CONTAINS":
      return { contains: String(f.value), mode: "insensitive" };
    case "NOT_CONTAINS":
      return { not: { contains: String(f.value), mode: "insensitive" } };
    case "STARTS_WITH":
      return { startsWith: String(f.value), mode: "insensitive" };
    case "IN":
      return { in: Array.isArray(f.value) ? f.value : [f.value] };
    case "NOT_IN":
      return { notIn: Array.isArray(f.value) ? f.value : [f.value] };
    case "GT": return { gt: f.value };
    case "GTE": return { gte: f.value };
    case "LT": return { lt: f.value };
    case "LTE": return { lte: f.value };
    case "IS_NULL": return null;
    case "IS_NOT_NULL": return { not: null };
    default: return undefined;
  }
}

/**
 * Pre-seeded system list views — applied via `prisma db push` then re-seeded.
 * Each entity has its own canonical set.
 */
export const SYSTEM_VIEWS: Record<string, Array<{
  name: string;
  developerName: string;
  filters: ListFilter[];
  sortField?: string;
  sortDir?: "asc" | "desc";
  isPinned?: boolean;
  sortOrder?: number;
}>> = {
  Lead: [
    { name: "All Leads", developerName: "All_Leads", filters: [], sortField: "updatedAt", isPinned: true, sortOrder: 0 },
    { name: "Recently Viewed", developerName: "Recently_Viewed_Leads", filters: [], sortField: "updatedAt", sortOrder: 1 },
    { name: "My Leads", developerName: "My_Leads", filters: [], sortField: "updatedAt", sortOrder: 2 },
    { name: "Web Leads", developerName: "Web_Leads", filters: [{ field: "recordType", op: "EQ", value: "WEB" }], sortField: "createdAt", isPinned: true, sortOrder: 3 },
    { name: "Direct Mail Leads", developerName: "Direct_Mail_Leads", filters: [{ field: "recordType", op: "EQ", value: "DIRECT_MAIL" }], sortField: "createdAt", sortOrder: 4 },
    { name: "List Leads", developerName: "List_Leads", filters: [{ field: "recordType", op: "EQ", value: "LIST" }], sortField: "createdAt", sortOrder: 5 },
    { name: "Cold Calls", developerName: "Cold_Calls", filters: [{ field: "source", op: "EQ", value: "COLD_CALL" }], sortField: "createdAt", sortOrder: 6 },
    { name: "Open Leads", developerName: "Open_Leads", filters: [{ field: "status", op: "IN", value: ["NEW", "CONTACTED", "QUALIFIED", "CALLBACK"] }], sortField: "createdAt", isPinned: true, sortOrder: 7 },
    { name: "Qualified Leads", developerName: "Qualified_Leads", filters: [{ field: "status", op: "EQ", value: "QUALIFIED" }], sortField: "createdAt", sortOrder: 8 },
    { name: "DNC List", developerName: "DNC_List", filters: [{ field: "status", op: "EQ", value: "DNC" }], sortField: "updatedAt", sortOrder: 9 },
    { name: "Archived Leads", developerName: "Archived_Leads", filters: [{ field: "recordType", op: "IN", value: ["ARCHIVED_WEB", "ARCHIVED_DIRECT_MAIL", "ARCHIVED_LIST"] }], sortOrder: 10 },
  ],
  Account: [
    { name: "All Accounts", developerName: "All_Accounts", filters: [], sortField: "updatedAt", isPinned: true, sortOrder: 0 },
    { name: "Clients", developerName: "Client_Accounts", filters: [{ field: "recordType", op: "IN", value: ["CLIENT", "BUSINESS_ACCOUNT", "PERSON_ACCOUNT"] }], isPinned: true, sortOrder: 1 },
    { name: "Creditors", developerName: "Creditor_Accounts", filters: [{ field: "recordType", op: "EQ", value: "CREDITOR" }], sortOrder: 2 },
    { name: "Vendors", developerName: "Vendor_Accounts", filters: [{ field: "recordType", op: "EQ", value: "VENDOR" }], sortOrder: 3 },
  ],
  Opportunity: [
    { name: "All Opportunities", developerName: "All_Opps", filters: [], sortField: "updatedAt", isPinned: true, sortOrder: 0 },
    { name: "Open Opportunities", developerName: "Open_Opps", filters: [{ field: "stage", op: "NOT_CONTAINS", value: "CLOSED" }], isPinned: true, sortOrder: 1 },
    { name: "Won This Month", developerName: "Won_This_Month", filters: [{ field: "stage", op: "CONTAINS", value: "WON" }], sortOrder: 2 },
    { name: "Debt Settlement", developerName: "Debt_Settlement_Opps", filters: [{ field: "recordType", op: "EQ", value: "DEBT_SETTLEMENT" }], sortOrder: 3 },
    { name: "Buyout", developerName: "Buyout_Opps", filters: [{ field: "recordType", op: "EQ", value: "BUYOUT" }], sortOrder: 4 },
  ],
  Case: [
    { name: "All Open Cases", developerName: "All_Open_Cases", filters: [{ field: "status", op: "NOT_IN", value: ["RESOLVED", "CLOSED"] }], isPinned: true, sortOrder: 0 },
    { name: "All Cases", developerName: "All_Cases", filters: [], sortOrder: 1 },
    { name: "Escalated", developerName: "Escalated_Cases", filters: [{ field: "status", op: "EQ", value: "ESCALATED" }], isPinned: true, sortOrder: 2 },
    { name: "Payment Issues", developerName: "Payment_Issues", filters: [{ field: "recordType", op: "EQ", value: "PAYMENT_ISSUE" }], sortOrder: 3 },
    { name: "Skip Payment", developerName: "Skip_Payment_Cases", filters: [{ field: "recordType", op: "EQ", value: "SKIP_PAYMENT" }], sortOrder: 4 },
  ],
};
