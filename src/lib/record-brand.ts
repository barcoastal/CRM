type BrandedRecord = { brand?: string | null; sfDataJson?: string | null };

export function recordBrand(...records: (BrandedRecord | null | undefined)[]): string | null {
  for (const record of records) {
    if (!record) continue;
    if (record.brand?.trim()) return record.brand.trim();
    try {
      const data = JSON.parse(record.sfDataJson ?? "{}");
      if (typeof data?.Brand__c === "string" && data.Brand__c.trim()) return data.Brand__c.trim();
    } catch { /* A damaged snapshot must not break the record page. */ }
  }
  return null;
}
