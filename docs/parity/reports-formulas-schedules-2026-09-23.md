# Report formulas, drill-downs and personal schedules

Adds up to ten saved row-level formula columns using supported numeric fields or constants: add, subtract, multiply, divide and percentage. Formulas are validated on save and execution, never evaluated as JavaScript. Missing values, zero division and non-finite results stay blank. Formula columns appear in saved report results, exports and report-backed dashboard previews; count/sum/average can summarize them.

Report users can select a group or click a chart label to inspect its detail rows. Metrics and CSV export follow the selected group. Record links open leads, opportunities, accounts, contacts and cases through their existing authorization.

Each user can subscribe to daily or weekly report-link emails to their own CRM email address at a chosen UTC hour. Results load upon opening the link; result snapshots are not included. The startup scheduler polls every minute, catches up missed occurrences once, checks active user/report permission and definition visibility, and advances each occurrence atomically with a durable email delivery row. Email sends use leases and a stable provider idempotency key/payload; uncertain retries stop before the provider’s 24-hour window expires. Delivery status/errors are visible in the Schedule panel. Recipient changes and revoked access cancel queued delivery. Users manage only their own schedules. No schedules or emails are created by deploying the feature alone.

Schema additions: Report.formulas JSON default [], ReportSubscription table with report/user foreign keys, unique report-user key and due-time index; ReportDelivery outbox with unique subscription/occurrence key and status/lease index. Existing report definitions remain compatible.

Validation: 514 tests passed, five skipped. Includes arithmetic/null cases, malformed/unsupported formulas, scoped formula results, schedule date boundaries, revoked access, duplicate worker claims, and per-user subscription APIs. The report Export CSV action now follows Reports.Export.

Remaining: arbitrary expressions/functions, formula-based filtering/sorting, multi-level grouping, cross-object joins beyond existing metadata, unrestricted full-data aggregates, scheduled result snapshots. Existing JSON/computed filter semantics still require further work. Group drill-downs remain within the report's configured result limit.

Provider reference: [Resend idempotency](https://resend.com/changelog/idempotency-keys). Provider success records acceptance, not confirmed inbox delivery.
