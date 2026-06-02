/**
 * Canonical SF-org-parity data — pulled from cdcrm.lightning.force.com via
 * the REST describe API. These are the exact picklist values + list views
 * the real Yati LLC Salesforce org uses.
 */

/** SF Lead.Status picklist — 4 stages, matches the Path component */
export const LEAD_STATUSES = [
  "New",
  "Working Lead",
  "Archive Disposition",
  "Converted",
] as const;
export type LeadStatusV2 = typeof LEAD_STATUSES[number];

/** SF Sub_Disposition__c picklist — 47 values */
export const LEAD_SUB_DISPOSITIONS: { value: string; label: string }[] = [
  { value: "Appointment", label: "Appointment" },
  { value: "Bad State", label: "Bad State" },
  { value: "Callback", label: "Callback" },
  { value: "Call Transferred from Fronter", label: "Call Transferred from Fronter" },
  { value: "Can't afford the program", label: "Can't afford the program" },
  { value: "Can't Save Weekly", label: "Can't Save Weekly" },
  { value: "Closed Lost", label: "Closed Lost" },
  { value: "Debt too new", label: "Debt too new" },
  { value: "DNC (Do not call)", label: "DNC (Do not call)" },
  { value: "Duplicate", label: "Duplicate" },
  { value: "Enrolled with another company", label: "Enrolled with another company" },
  { value: "Fake Lead", label: "Fake Lead" },
  { value: "Left VM", label: "Left VM" },
  { value: "Looking for a loan", label: "Looking for a loan" },
  { value: "Lowered Payments with Lenders", label: "Lowered Payments with Lenders" },
  { value: "No Answer", label: "No Answer" },
  { value: "No Answer-5up", label: "No Answer-5up" },
  { value: "Not Enough Debt", label: "Not Enough Debt" },
  { value: "Not Interested - High UCC Risk", label: "Not Interested - High UCC Risk" },
  { value: "Not Interested Qualified", label: "Not Interested Qualified" },
  { value: "Number not in use", label: "Number not in use" },
  { value: "Other", label: "Other" },
  { value: "Payments are sustainable", label: "Payments are sustainable" },
  { value: "Phone not in use", label: "Phone not in use" },
  { value: "Stopped Answering", label: "Stopped Answering" },
  { value: "Transfer Not Qualified", label: "Transfer Not Qualified" },
  { value: "VM Full", label: "VM Full" },
  { value: "Wrong Number", label: "Wrong Number" },
  { value: "SMS sent", label: "SMS sent" },
  { value: "Fake Leads", label: "Fake Leads" },
  { value: "No MCA Debt", label: "No MCA Debt" },
  { value: "Stage Change", label: "Stage Change" },
  { value: "Never Answered", label: "Never Answered" },
  { value: "Not Interested", label: "Not Interested" },
  { value: "Notes", label: "Notes" },
  { value: "Left Review", label: "Left Review" },
  { value: "Archived - Duplicate Lead", label: "Archived - Duplicate Lead" },
  { value: "Call Transferred (TO)", label: "Call Transferred (TO)" },
  { value: "Test Lead", label: "Test Lead" },
  { value: "DIDNT Register", label: "DIDNT Register" },
  { value: "Active Opportunity Exists", label: "Active Opportunity Exists" },
  { value: "Active Web Lead Exists", label: "Active Web Lead Exists" },
  { value: "New Web Lead Created", label: "New Web Lead Created" },
  { value: "Active Lead Exists", label: "Active Lead Exists" },
  { value: "New Non-Web Lead Created", label: "New Non-Web Lead Created" },
  { value: "Final Stage", label: "Final Stage" },
  { value: "High Risk", label: "High Risk" },
];

/**
 * Map each disposition to the Lead.status it should transition the lead to.
 * Inferred from naming — dispositions that look like archives go to
 * "Archive Disposition", DNC goes to "Archive Disposition" too, conversions
 * → "Converted", everything else → "Working Lead".
 */
export const DISPOSITION_TO_STATUS: Record<string, LeadStatusV2> = {
  "DNC (Do not call)": "Archive Disposition",
  "Closed Lost": "Archive Disposition",
  "Duplicate": "Archive Disposition",
  "Fake Lead": "Archive Disposition",
  "Fake Leads": "Archive Disposition",
  "Archived - Duplicate Lead": "Archive Disposition",
  "Not Interested": "Archive Disposition",
  "Not Interested - High UCC Risk": "Archive Disposition",
  "Not Interested Qualified": "Archive Disposition",
  "Number not in use": "Archive Disposition",
  "Phone not in use": "Archive Disposition",
  "Wrong Number": "Archive Disposition",
  "VM Full": "Archive Disposition",
  "Bad State": "Archive Disposition",
  "Test Lead": "Archive Disposition",
  "Debt too new": "Archive Disposition",
  "Not Enough Debt": "Archive Disposition",
  "No MCA Debt": "Archive Disposition",
  "Can't afford the program": "Archive Disposition",
  "Can't Save Weekly": "Archive Disposition",
  "Payments are sustainable": "Archive Disposition",
  "Enrolled with another company": "Archive Disposition",
  "Lowered Payments with Lenders": "Archive Disposition",
  "Looking for a loan": "Archive Disposition",
  "Active Opportunity Exists": "Converted",
  "Final Stage": "Converted",
  // Default for everything else → Working Lead
};

/** SF Lead Source picklist — ~50 values */
export const LEAD_SOURCES = [
  "Website", "Web", "Bing", "Phone Inquiry", "Partner Referral", "Other",
  "Social", "Google", "Webform", "Affiliate", "Organic", "Transfer",
  "Broker Lead", "Calendly", "Inbound Call", "TB", "LawSuit", "GOOGLE ADS",
  "Organic M", "IB - Google", "IB - Social", "IB - Youtube", "IB - Bing",
  "Bullmarket", "Direct Mail", "IB - Debtco", "IB - Organic M", "List Lead",
  "IB - Social Spanish", "IB - Direct Mail", "IB - Google Spanish",
  "IB - Bing Spanish", "IB - Outbrain", "Vibe CTV", "YouTube", "IB - Reddit",
  "Reddit", "TikTok",
] as const;

/** SF Lead list views (system + topic-based; skipping personal user-owned views) */
export const SF_LEAD_LIST_VIEWS: {
  name: string;
  developerName: string;
  filters: { field: string; op: string; value?: unknown }[];
  sortField?: string;
  isPinned?: boolean;
  sortOrder: number;
}[] = [
  { name: "Recently Viewed", developerName: "RecentlyViewedLeads", filters: [], sortField: "updatedAt", sortOrder: 0 },
  { name: "My Leads", developerName: "My_Leads", filters: [], sortField: "updatedAt", isPinned: true, sortOrder: 1 },
  { name: "My Unread Leads", developerName: "MyUnreadLeads", filters: [], sortField: "createdAt", sortOrder: 2 },
  { name: "My Team Leads", developerName: "My_Team_Leads", filters: [], sortField: "updatedAt", sortOrder: 3 },
  { name: "Today's Web Leads", developerName: "Todays_Web_Leads", filters: [{ field: "recordType", op: "EQ", value: "WEB" }], sortField: "createdAt", isPinned: true, sortOrder: 4 },
  { name: "Un-Assigned Web Leads", developerName: "Un_Assigned_Web_Leads", filters: [{ field: "recordType", op: "EQ", value: "WEB" }, { field: "assignedToId", op: "IS_NULL" }], sortField: "createdAt", isPinned: true, sortOrder: 5 },
  { name: "Closer Pool", developerName: "Closer_Pool_Lead", filters: [], sortField: "createdAt", isPinned: true, sortOrder: 6 },
  { name: "Calendly Leads", developerName: "Calendly_Leads", filters: [{ field: "source", op: "EQ", value: "Calendly" }], sortField: "createdAt", sortOrder: 7 },
  { name: "Lawsuit Leads", developerName: "Lawsuit_Leads", filters: [{ field: "source", op: "EQ", value: "LawSuit" }], sortField: "createdAt", sortOrder: 8 },
  { name: "Leads for Survey", developerName: "Simone_Reviews_Leads", filters: [{ field: "status", op: "EQ", value: "Converted" }], sortField: "updatedAt", sortOrder: 9 },
  { name: "Web Leads - Archived", developerName: "Copy_of_Web_Leads_Archived", filters: [{ field: "recordType", op: "EQ", value: "WEB" }, { field: "status", op: "EQ", value: "Archive Disposition" }], sortField: "updatedAt", sortOrder: 10 },
];
