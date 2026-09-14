export const PAYMENT_STATUSES = ["Current", "Default", "Reprieve"] as const;

export function debtSnapshot(json: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(json ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function debtPaymentStatus(json: string | null | undefined): string {
  const value = debtSnapshot(json).Debt_Status__c;
  return typeof value === "string" ? value : "";
}
