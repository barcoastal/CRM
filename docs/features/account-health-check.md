# Account Health Check parity

Reference verified September 17, 2026: live Salesforce Account Health Check Results and the exported `HealthCheckerAccount`, `TaskData`, `HealthCheckController`, and `HealthCheckerResult` Apex classes under `/Users/baralezrah/docs/sf-export/sfdx-raw/classes`.

- Welcome Call passes only when the account has a COMPLETED task whose subject contains `Welcome Call Completed` (case insensitive).
- First Payment passes only when the account's `First_Payment_Completed_Date__c` is populated, read from the synced account data.
- Manual welcome-call/payment checkboxes and opportunity stages do not override these checks. This intentionally removes the previous shortcut; native payment processing must populate the completion-date field to satisfy this Salesforce rule.
- Failed results sort before successful results; equal severity retains welcome-call/payment order. Overall status is the worst result.
- Labels and SLDS success/error icons match Salesforce. Header uses the observed gray background, 24px summary icon and 16px result icons.
- Collapse/expand is keyboard accessible. Refresh reruns the authenticated server page queries via router.refresh; it reads current CRM data, it does not initiate a Salesforce sync.
- Existing account permissions and record scope protect the page and its refreshed results. This change does not write account, task, or payment records.

Validation: nine rule tests, TypeScript, ESLint, production build, and browser checks of the actual component's four status combinations and controls.

September 23 live recheck: the same account has no Health Check in Account Engagement but shows both Welcome Call and First Payment results in Debt Settlement. The CRM follows the Debt Settlement account layout. App-specific visibility is not inferred from the Account Engagement layout.
