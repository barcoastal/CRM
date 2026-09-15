# Reports and dashboards: access enforcement

## Problem and behavior

A non-admin could run reports and dashboard aggregates across unrelated teams, read private report definitions, and modify shared dashboards or their tiles without owning them. This change scopes analytics data to explicit assignments/reporting relationships and separates viewing shared definitions from editing them.

- Every analytics entry point authenticates an active user and checks its Reports or Dashboards capability. Server-rendered pages redirect unauthenticated users to login and hide unavailable pages.
- Lead/Opportunity ownership uses assignedToId. Account/Contact/Task/Event/Case analytics use ownerId. Managers include descendants connected through User.managerId; a MANAGER role or Modify.AllData permission does not bypass the assignment policy. Active ADMIN/SUPER_ADMIN users retain full access.
- Saved/ad-hoc report execution enforces the data scope inside the shared runner, ANDed with user filters. Totals and charts derive from those scoped rows. Missing object View permission returns no records for that object.
- Report relation projections mask inaccessible Account/Contact/Lead/Opportunity/Case values. Filters, sorting, grouping and summaries on a protected relation also constrain that relation, preventing hidden values from affecting results. These relation-dependent reports may therefore exclude otherwise visible parent rows whose related record is inaccessible.
- Built-in dashboard tile aggregates and the home manager dashboard apply the same scopes. Home Key Deals redact inaccessible linked accounts. Personal task/event widgets retain their existing current-user filter.
- Envelope analytics require at least one parent and visibility into every linked Lead/Opportunity/Account. Unsupported analytics models fail closed for non-admins.
- Shared report/dashboard definitions are readable with the corresponding capability; private definitions are readable by their owner or an active admin. Mutation also requires ownership/admin access and the relevant capability. Dashboard mutation uses the existing Dashboards.Create permission because the catalog has no separate Edit permission.
- Dashboard/report definition updates and deletes carry the ownership predicate in the write query. Tile mutations constrain both dashboard ID and ownership. Read-only viewers no longer see detail-page Edit controls.
- The legacy /api/dashboard/stats endpoint is admin-only pending an approved financial/telephony sharing policy. Its DashboardContent component has no page caller in this source tree; the current homepage uses the scoped /api/dashboard/manager endpoint.

No migrations, production user edits, role grants or manager assignments are part of this change.

## Verification

- 37 focused tests pass: analytics isolation plus existing record scope, session refresh, bulk-delete authorization and opportunity permission regressions.
- New fixture-based tests cover unrelated teams, descendants, agent/manager/admin behavior, data/chart totals, relation redaction, OR-filter and relation-filter attacks, object permission denial, deactivation, permission refresh, private report IDs, owner versus reader tile mutations, envelope parent requirements and all dashboard registry queries when logged out.
- Full suite: 311 passed, 1 failed (312 total). The isolated failure is the existing `defaultOpportunityName` hyphen versus em-dash expectation in `tests/lib/lead-conversion.test.ts`; both that file and its implementation are unchanged from the deployed base.
- TypeScript, targeted ESLint, whitespace checks and production webpack build are checked before handoff. The repo's existing middleware deprecation warning remains.
- Tests use independent team fixtures and a mock database query evaluator. They are not a production restricted-user penetration test or a real-database integration fixture.

## Rollout and remaining work

This patch is prepared locally; it does not deploy itself. Base commit 02d65ee was verified in production on September 15, despite the older rollout note saying otherwise.

The production read-only snapshot has 136 active users, 134 without managerId; two of those 134 have admin roles. The separate local team-assignment review lists every missing link. A business owner must distinguish actual missing relationships from intentional root/admin/service accounts. No relationships were guessed.

This closes the report/dashboard portion of the access audit. Other non-analytics related lists, dialer/lookups, financial workflows, field-level policy, reassignment authorization, deletion recovery and general task/case/document sharing remain separate rollout work. Sharing rules for analytics do not establish protection for those other routes. There is no server-side CSV export endpoint in the inspected report module; any future export must reuse this scoped runner and enforce Reports.Export.
