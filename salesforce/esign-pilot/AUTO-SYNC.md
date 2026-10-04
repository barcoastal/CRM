# Sandbox automatic signing sync

Enabled only in newdocusig for Opportunity 006jI000000HCfvQAG.
Run scripts/enable-auto-sync.apex as the authorized pilot user to install the schedule.
Twelve hourly schedules, offset five minutes, enqueue one callout worker. Salesforce queue load can delay execution. Existing active workers prevent a backlog. Failed workers appear in Setup > Apex Jobs and retry at the next interval. Completed packets with an attached file and declined/voided/expired packets stop polling; a new packet on the same Opportunity resumes polling.

The worker uses the existing Named Credential and sandbox/custom-permission checks. It calls the same refresh operation as the manual button. The operation locks and rechecks the packet pointer before updating, and attaches the completed PDF only when the file reference is absent. Unchanged statuses cause no Opportunity write. StageName is not updated. The status card reloads saved values every 30 seconds while visible.

To disable, delete the twelve Scheduled Jobs named `Coastal Sign - sandbox sync <minute>` in Salesforce Setup. No CRM deployment is required for these Salesforce-only changes.

Validation: deployment 0AfjI0000002xTpSAI passed nine tests; additional failure/retry test deployment 0AfjI0000002xVRSAY passed all ten. Live worker 707jI000000MjyIQAS completed with zero errors. Completion/PDF attachment and retry behavior were tested with mocked CRM responses; no real contract was signed by the automation.
