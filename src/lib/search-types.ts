export const SEARCH_TYPES = [
  {
    key: "leads",
    label: "Leads",
    entity: "Lead",
    permission: "Lead.View",
    path: "/leads",
    color: "#f88962",
    icon: "lead",
    columns: [
      "Name",
      "Lead ID",
      "Company",
      "Phone",
      "Lead Status",
      "Lead Source",
      "Owner",
      "Sub Disposition",
    ],
  },
  {
    key: "opportunities",
    label: "Opportunities",
    entity: "Opportunity",
    permission: "Opportunity.View",
    path: "/opportunities",
    color: "#ff9a3c",
    icon: "opportunity",
    columns: [
      "Opportunity Name",
      "Account Name",
      "Stage",
      "Close Date",
      "Total Debt Included",
      "Lead ID",
      "Owner",
    ],
  },
  {
    key: "contacts",
    label: "Contacts",
    entity: "Contact",
    permission: "Contact.View",
    path: "/contacts",
    color: "#a094ed",
    icon: "contact",
    columns: ["Name", "Account Name", "Title", "Phone", "Email", "Owner"],
  },
  {
    key: "accounts",
    label: "Accounts",
    entity: "Account",
    permission: "Account.View",
    path: "/accounts",
    color: "#7f8de1",
    icon: "account",
    columns: [
      "Account Name",
      "Phone",
      "Email",
      "Client Status",
      "Brand",
      "Owner",
    ],
  },
  {
    key: "people",
    label: "People",
    entity: "User",
    permission: "User.View",
    path: "/settings/users",
    color: "#5c799e",
    icon: "user",
    columns: ["Full Name", "Email", "Role", "Status"],
  },
  {
    key: "cases",
    label: "Cases",
    entity: "Case",
    permission: "Case.View",
    path: "/cases",
    color: "#f2cf5b",
    icon: "case",
    columns: ["Subject", "Case Number", "Status", "Priority", "Owner"],
  },
  {
    key: "tasks",
    label: "Tasks",
    entity: "Task",
    permission: "Task.View",
    path: "/tasks",
    color: "#4bc076",
    icon: "task",
    columns: ["Subject", "Status", "Priority", "Due Date", "Owner"],
  },
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number]["key"];
export type SearchSort = "name" | "name-desc" | "newest";
export type SearchCell = { text: string; href?: string };
export type SearchRow = {
  id: string;
  entity: string;
  title: string;
  subtitle: string;
  href: string;
  cells: SearchCell[];
};
export type SearchGroup = {
  type: SearchType;
  count: number;
  page: number;
  pageSize: number;
  rows: SearchRow[];
};
export type SearchResponse = {
  query: string;
  total: number;
  groups: SearchGroup[];
};
export function normalizeSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
export function searchType(
  value: string | null | undefined,
): SearchType | undefined {
  return SEARCH_TYPES.find((t) => t.key === value)?.key;
}
export function searchSort(value: string | null | undefined): SearchSort {
  return value === "name-desc" || value === "newest" ? value : "name";
}
export function searchPage(value: string | null | undefined) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 1_000_000) : 1;
}
export function searchHref(
  q: string,
  type?: SearchType,
  page = 1,
  sort: SearchSort = "name",
) {
  const params = new URLSearchParams({ q: normalizeSearchQuery(q) });
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));
  if (sort !== "name") params.set("sort", sort);
  return `/search?${params}`;
}
