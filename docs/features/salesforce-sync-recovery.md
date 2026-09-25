# Salesforce incremental sync

The sync imports Salesforce into this CRM. CRM scoreboard totals continue to
read stored CRM opportunities; they do not query Salesforce in the browser.

Run `tsx scripts/run-sf-sync.ts` with `DATABASE_URL` and a persistent
`SF_SYNC_STATE_DIR`. Authenticate through `SF_AUTH_URL` or the local Salesforce
CLI alias `coastal`. Optional arguments select entities, for example
`account contact opportunity` for the frequent sales refresh.

Each entity has an independent checkpoint. A successful import advances it to
the run's shared source cutoff; the next run overlaps five minutes. Using one
cutoff keeps newly created parents and children in the same window. Failed
exports, writes, or missing required parents retain the checkpoint. A transient
database failure is retried; an entity gets two attempts. Exports are paginated
and atomically replaced. Writes use bounded batches with preserved source-field
mappings, IDs, defaults, and explicit primary-contact relationships.
Source records without a parent required by the CRM are excluded. A populated
source parent that is missing from CRM still fails the import for recovery.

The command uses a PID lock so the frequent sales job and full nightly job
cannot overlap. A dead process's lock can be reclaimed; live jobs are never
killed based only on lock age. An entity timeout terminates only its own process
group. Logs omit source record values and credentials.

For recovery, set `SF_SINCE` to an explicit UTC timestamp before the first failed
run. Remove it after recovery so future jobs use checkpoints. Set
`SF_SYNC_BACKUP_DIR` to retain private pre-import snapshots of existing account,
contact, and opportunity records. `SF_ONLY_IDS` accepts at most 200 source IDs
for targeted repair. `SF_EXPORT_ONLY=1` exports without importing.

The local production scheduler uses a dedicated checkout in `crm-sync/app`,
state in `crm-sync/state`, and `crm-sync/run-sf-sync.sh`. The full nightly
LaunchAgent is `com.coastal.sf-sync`; the five-minute sales agent is
`com.coastal.sf-sales-sync`. Keep credentials in the private local wrapper,
never in this repository. Railway's in-app runner uses `/data/sf-sync-state`
when enabled with `SF_AUTH_URL`.

Regression coverage includes checkpoint retention, transient retries, CSV
pagination/escaping, bounded writes, contact propagation, and real PostgreSQL
batch-upsert behavior. PostgreSQL tests use session-local temporary tables via
`CLOSER_TEST_DATABASE_URL`, never production application tables.
