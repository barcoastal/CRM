export const CRM_LEAD_FIELDS = [
  "leadName",
  "businessName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "mobilePhone",
  "street",
  "city",
  "state",
  "postalCode",
  "country",
  "gclid",
  "fbclid",
  "leadSource",
  "company",
  "title",
  "amount",
] as const;

export type CrmLeadField = (typeof CRM_LEAD_FIELDS)[number];
