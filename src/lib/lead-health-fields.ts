import type { Lead } from "@/generated/prisma/client";
import { snapshot } from "@/lib/automation/lead-routing";

type LeadWrite = Partial<Lead> & Record<string, unknown>;
const pairs = { businessName: "Company", source: "LeadSource", industry: "Industry" } as const;
const own = (row: object, key: string) => Object.prototype.hasOwnProperty.call(row, key);

export function splitLeadName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || name.trim().toLowerCase() === "new inbound") {
    return { FirstName: null, LastName: name.trim() || null };
  }
  return { FirstName: parts[0], LastName: parts.slice(1).join(" ") };
}

/** Keep edits and the fields consumed by the source health checker consistent. */
export function syncLeadHealthFields(next: LeadWrite, prev?: Lead) {
  const before = snapshot(prev?.sfDataJson);
  const incoming = snapshot(next.sfDataJson);
  const sf = { ...before, ...incoming };
  for (const [column, key] of Object.entries(pairs)) {
    if (own(next, column) && (prev || !own(incoming, key))) sf[key] = next[column];
    else if (own(incoming, key) && (!prev || incoming[key] !== before[key])) {
      next[column] = incoming[key] ?? (column === "industry" ? null : "");
    }
  }
  const namesChanged = ["FirstName", "LastName"].some(key => own(incoming, key) && (!prev || incoming[key] !== before[key]));
  if (namesChanged) {
    next.contactName = [sf.FirstName, sf.LastName].filter(Boolean).join(" ");
  } else if (own(next, "contactName") && (!prev || next.contactName !== prev.contactName)) {
    Object.assign(sf, splitLeadName(String(next.contactName ?? "")));
  }
  // Current_Total_Debt_Amount__c is a formula over all ten creditor balances,
  // not Estimated Total Debt. Preserve imported formula values until an input changes.
  const debtKeys = Array.from({ length: 10 }, (_, i) => `Creditor_${i + 1}_Total_Debt__c`);
  if (debtKeys.some(key => own(incoming, key) && (!prev || incoming[key] !== before[key]))) {
    sf.Current_Total_Debt_Amount__c = debtKeys.reduce((sum, key) => {
      const amount = Number(sf[key] ?? 0);
      return sum + (Number.isFinite(amount) ? Math.round(amount * 100) : 0);
    }, 0) / 100;
  }
  next.sfDataJson = JSON.stringify(sf);
}
