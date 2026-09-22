/** Read older saved layouts without changing their persisted definitions. */
const LEGACY_COLUMNS: Record<string, string> = {
  "owner.name": "ownerFullName",
  "primaryContact.name": "primaryContact",
  stage: "clientStatus",
  currentTotalDebt: "totalDebt",
  firstContractSignedDate: "firstContractSigned",
  updatedAt: "lastModified",
};

export function normalizeAccountColumns(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keys = value.filter((key): key is string => typeof key === "string")
    .map(key => LEGACY_COLUMNS[key] ?? key);
  return keys.length ? [...new Set(keys)] : undefined;
}

export function resolveAccountView<T extends { id: string; developerName: string | null }>(views: T[], value: string): T | undefined {
  return views.find(view => value === `custom:${view.id}` ||
    (view.developerName !== null && value === `view:${view.developerName}`));
}
