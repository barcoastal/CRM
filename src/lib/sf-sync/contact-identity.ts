/** Salesforce owns contact identity fields; blank values clear the CRM value. */
export function contactIdentity(sf: Record<string, string | undefined>) {
  for (const field of ["Birthdate", "SSN__c"]) {
    if (sf[field] === undefined) throw new Error(`Contact export missing required field: ${field}`);
  }
  const dob = sf.Birthdate!.trim();
  const birthdate = dob ? new Date(`${dob}T00:00:00.000Z`) : null;
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !birthdate ||
      Number.isNaN(birthdate.getTime()) || birthdate.toISOString().slice(0, 10) !== dob)) {
    throw new Error("Contact export contains an invalid Birthdate");
  }
  // Keep SSNs as strings so leading zeroes survive the import.
  const ssn = sf.SSN__c!.trim() || null;
  return { birthdate, ssn };
}
