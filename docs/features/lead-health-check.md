# Lead Health Check parity

Verified against exported HealthCheckerLead.cls and a live New lead in Salesforce on September 17, 2026. Uses the shared Salesforce-style Health Check card, including refresh, collapse, summary status, and failed-first ordering.

The panel appears on every lead. Checks run only for New and Working Lead (including native NEW). Other statuses show a neutral not-applicable message, with refresh and collapse available, rather than hiding the panel or implying a successful check. Nine checks: Company; both FirstName and LastName (despite the original label saying “Or”); all four call-disposition fields; positive Creditor_1_Total_Debt__c; Current_Total_Debt_Amount__c at least 30000; Industry; Is_Payment_Amount_Populated__c; LastName unequal to New Inbound; nonblank LeadSource. Original Salesforce messages, including its “Diposition” typo, are retained.

For Salesforce records, names/company/source and the debt formula come from their specific synced fields. A generic estimated debt, arbitrary related debt record, or default OTHER source no longer overrides missing Salesforce evidence. Native lead names are split from contactName because the CRM has no separate lead first/last-name columns. Refresh rechecks local CRM data; Salesforce synchronization is separate.

Opportunity scope: the export has HealthCheckerOpportunityI but no implementing checker. The live Pending Client Approval opportunity inspected had no Health Check panel. No speculative opportunity rules or panel were added. This evidence does not guarantee every Salesforce record type uses the same layout.

Validation: 22 lead/account rule tests, TypeScript, lint, production build, and browser checks.
