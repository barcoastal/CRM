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

/**
 * For each Lead.Stage, the allowed Sub_Disposition__c values when picking
 * a sub-disposition in the Disposition modal. Derived from the actual SF
 * Lightning modal dropdowns in the Yati org.
 */
export const STAGE_TO_SUB_DISPOSITIONS: Record<LeadStatusV2, string[]> = {
  "New": [
    "Left VM",
    "No Answer",
    "Wrong Number",
    "SMS sent",
    "Stage Change",
    "Left Review",
    "DIDNT Register",
  ],
  "Working Lead": [
    "Appointment",
    "Callback",
    "Call Transferred from Fronter",
    "Left VM",
    "No Answer",
    "No Answer-5up",
    "Phone not in use",
    "VM Full",
    "Wrong Number",
    "SMS sent",
    "Stage Change",
    "Left Review",
    "Call Transferred (TO)",
    "DIDNT Register",
  ],
  "Archive Disposition": [
    "Bad State",
    "Can't afford the program",
    "Can't Save Weekly",
    "Closed Lost",
    "Debt too new",
    "DNC (Do not call)",
    "Duplicate",
    "Enrolled with another company",
    "Fake Lead",
    "Looking for a loan",
    "Lowered Payments with Lenders",
    "Not Enough Debt",
    "Not Interested",
    "Not Interested - High UCC Risk",
    "Not Interested Qualified",
    "Number not in use",
    "Other",
    "Payments are sustainable",
    "Phone not in use",
    "Stopped Answering",
    "Transfer Not Qualified",
    "Wrong Number",
    "VM Full",
    "No MCA Debt",
    "Never Answered",
    "Test Lead",
    "Fake Leads",
    "Archived - Duplicate Lead",
    "High Risk",
  ],
  "Converted": [
    "Active Opportunity Exists",
    "Active Web Lead Exists",
    "New Web Lead Created",
    "Active Lead Exists",
    "New Non-Web Lead Created",
    "Final Stage",
  ],
};

/** Call Result picklist on the Log Disposition section */
export const CALL_RESULTS = [
  "Successful Transfer",
  "Hung Up",
  "Technical Issue",
] as const;

/** Status picklist on the Log Disposition section (Task status) */
export const DISPOSITION_TASK_STATUSES = [
  "Completed",
  "Not Started",
  "In Progress",
  "Waiting on someone else",
  "Deferred",
] as const;

/** SF Opportunity stages — verified against the live org's OpportunityStage picklist. */
export const OPP_STAGES = [
  "Working Opportunity",
  "Waiting for Agreements",
  "Agreements Received",
  "Ready To Close",
  "Contract Sent",
  "Contract Signed",
  "Archived",
  "Archived - Finalized",
  "Closed Won First Payment Pending",
  "Closed Won - First Payment Completed",
  "Closed Lost",
] as const;
export type OppStage = typeof OPP_STAGES[number];

/**
 * Final stage that flips the opportunity into Account land — when an opp
 * reaches "Closed Won - First Payment Completed", a Client record is
 * created/ensured and the user gets routed to the Account.
 */
export const OPP_STAGE_FINAL_WIN = "Closed Won - First Payment Completed" as const;

/**
 * For each Opp.Stage, the allowed Sub_Disposition__c values when picking
 * in the Disposition modal. Derived from the actual SF Lightning dropdowns
 * on the Opportunity object.
 */
export const OPP_STAGE_TO_SUB_DISPOSITIONS: Record<OppStage, string[]> = {
  "Working Opportunity": [
    "Appointment",
    "Callback",
    "Call Transferred from Fronter",
    "Left VM",
    "No Answer",
    "No Answer-5up",
    "Phone not in use",
    "VM Full",
    "Wrong Number",
    "SMS sent",
    "Notes",
    "Stage Change",
    "Left Review",
    "Didn't Register",
    "Opportunity Reactivated",
    "Opportunity Reshuffled",
  ],
  "Waiting for Agreements": [
    "Appointment",
    "Callback",
    "Call Transferred from Fronter",
    "Left VM",
    "No Answer",
    "No Answer-5up",
    "Phone not in use",
    "VM Full",
    "Wrong Number",
    "SMS sent",
    "Notes",
    "Stage Change",
    "Left Review",
    "Didn't Register",
    "Opportunity Reshuffled",
  ],
  "Agreements Received": [
    "Appointment",
    "Callback",
    "Call Transferred from Fronter",
    "Left VM",
    "No Answer",
    "No Answer-5up",
    "Phone not in use",
    "VM Full",
    "Wrong Number",
    "SMS sent",
    "Notes",
    "Stage Change",
    "Left Review",
    "Didn't Register",
    "Opportunity Reshuffled",
  ],
  "Ready To Close": [
    "Appointment",
    "Callback",
    "Call Transferred from Fronter",
    "Left VM",
    "No Answer",
    "No Answer-5up",
    "Phone not in use",
    "VM Full",
    "Wrong Number",
    "SMS sent",
    "Notes",
    "Stage Change",
    "Left Review",
    "Resend contract",
    "Didn't Register",
    "Opportunity Reshuffled",
  ],
  "Contract Sent": [
    "Appointment",
    "Callback",
    "Call Transferred from Fronter",
    "Left VM",
    "No Answer",
    "No Answer-5up",
    "Phone not in use",
    "VM Full",
    "Wrong Number",
    "SMS sent",
    "Notes",
    "Stage Change",
    "Left Review",
    "Didn't Register",
    "Opportunity Reshuffled",
  ],
  "Contract Signed": [
    "Appointment",
    "Callback",
    "Call Transferred from Fronter",
    "Left VM",
    "No Answer",
    "No Answer-5up",
    "Phone not in use",
    "VM Full",
    "Wrong Number",
    "SMS sent",
    "Notes",
    "Stage Change",
    "Left Review",
    "Didn't Register",
    "Opportunity Reshuffled",
  ],
  "Archived": [
    "Bad State",
    "Can't afford the program",
    "Can't Save Weekly",
    "Closed Lost",
    "DNC (Do not call)",
    "Duplicate",
    "Enrolled with another company",
    "Fake Lead",
    "Not Interested",
    "Not Interested Qualified",
    "Looking for a loan",
    "Lowered Payments with Lenders",
    "Other",
    "Payments are sustainable",
    "Stopped Answering",
    "Stage Change",
  ],
  "Archived - Finalized": [
    "Stage Change",
    "Notes",
  ],
  "Closed Won First Payment Pending": [
    "First Payment Pending",
    "First Payment Scheduled",
    "Awaiting Funds",
    "Stage Change",
    "Notes",
  ],
  "Closed Won - First Payment Completed": [
    "First Payment Completed",
    "Active Client",
    "Stage Change",
    "Notes",
  ],
  "Closed Lost": [
    "Closed Lost",
    "Lost - Competitor",
    "Lost - Price",
    "Lost - No Decision",
    "Lost - Other",
    "Notes",
  ],
};

/** SF Account stages (8 — matches the path on Account detail) */
export const ACCOUNT_STAGES = [
  "First Payment pending",
  "Active",
  "On Hold",
  "Pending Cancellation",
  "Cancelled",
  "Suspended",
  "Graduated",
  "Closed Duplicate",
] as const;
export type AccountStage = typeof ACCOUNT_STAGES[number];

export const ACCOUNT_STAGE_TO_SUB_DISPOSITIONS: Record<AccountStage, string[]> = {
  "First Payment pending": [
    "Awaiting First Draft",
    "First Payment Scheduled",
    "Welcome Call Pending",
    "Welcome Call Completed",
    "Notes",
    "Stage Change",
  ],
  "Active": [
    "Welcome Call Completed",
    "Payment Received",
    "Payment Skipped",
    "Reschedule Requested",
    "Reschedule Completed",
    "Settlement Authorized",
    "Settlement Completed",
    "Notes",
    "Stage Change",
  ],
  "On Hold": [
    "Hardship Hold",
    "Payment Hold",
    "Document Hold",
    "Legal Hold",
    "Bank Change Pending",
    "Notes",
    "Stage Change",
  ],
  "Pending Cancellation": [
    "Cancel Requested",
    "Final Payment Pending",
    "Awaiting Refund",
    "Notes",
    "Stage Change",
  ],
  "Cancelled": [
    "Client Cancelled",
    "NSF Cancelled",
    "Cancelled - Refund Issued",
    "Cancelled - No Refund",
    "Notes",
  ],
  "Suspended": [
    "NSF Suspension",
    "Documentation Suspension",
    "Compliance Suspension",
    "Notes",
    "Stage Change",
  ],
  "Graduated": [
    "Program Completed",
    "All Debts Settled",
    "Final Payment Received",
    "Notes",
  ],
  "Closed Duplicate": [
    "Merged with Account",
    "Created in Error",
    "Notes",
  ],
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
