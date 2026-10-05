import { snapshot } from "@/lib/automation/lead-routing";

const REQUIRED_FIELDS = {
  five9_Disposition__c: "Five9 Disposition",
  CloserLookup__c: "Closer",
  Call_Transfer_Status__c: "Call Transfer Status",
  Call_Received_By_Lookup__c: "Call Received By",
  Call_Received_Date__c: "Call Received Date",
} as const;

/** Shared by the health check and every lead-conversion entry point. */
export function missingLeadCallDispositionFields(sfData: Record<string, unknown>): string[] {
  return Object.entries(REQUIRED_FIELDS)
    .filter(([key]) => typeof sfData[key] !== "string" || !sfData[key].trim())
    .map(([, label]) => label);
}

export function assertLeadCallDisposition(sfDataJson: string | null | undefined): void {
  const missing = missingLeadCallDispositionFields(snapshot(sfDataJson));
  if (missing.length) {
    throw new Error(`Call Disposition is required to convert a Lead. Complete ${missing.join(", ")} in the call disposition details.`);
  }
}
