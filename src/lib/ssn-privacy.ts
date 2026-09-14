/** Presentation boundary only: never use redacted records for database writes. */
export function isSsnField(key: string): boolean {
  const field = key.split(".").at(-1)!.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /^(?:(?:contact|client|person)?ssn(?:encrypted|last4|masked)?(?:c|pc)?|socialsecurity(?:number)?(?:c|pc)?)$/.test(field);
}

export function maskSsn(value: unknown): string | null {
  if (value == null || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 4 ? `XXX-XX-${digits.slice(-4)}` : "XXX-XX-XXXX";
}

export function canRevealSsn(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Covers typed fields, Salesforce JSON snapshots, nested records and field history. */
export function redactSsn<T>(input: T): T {
  if (Array.isArray(input)) return input.map(redactSsn) as T;
  if (!input || typeof input !== "object") return input;
  // Preserve Date/Decimal and other non-record values for normal serialization.
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return input;
  const row = input as Record<string, unknown>;
  const historySsn = typeof row.field === "string" && isSsnField(row.field);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (isSsnField(key) || (historySsn && ["oldValue", "newValue", "value"].includes(key))) {
      return [key, maskSsn(value)];
    }
    if (typeof value === "string" && /(?:json|before|after)$/i.test(key)) {
      try { return [key, JSON.stringify(redactSsn(JSON.parse(value)))]; }
      catch { return [key, key === "sfDataJson" ? null : value]; }
    }
    return [key, redactSsn(value)];
  })) as T;
}
