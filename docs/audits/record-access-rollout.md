# Assigned-record access rollout

User-approved policy (2026-09-14): agents see assigned records, managers see their teams, admins see everything.

Base implementation 02d65ee verified deployed on September 15, 2026. It is not yet a complete security boundary.

The report/dashboard extension is documented in [analytics-access-2026-09-15.md](analytics-access-2026-09-15.md) and is pending deployment.

## Deployed base implementation

- Shared scope for Lead/Opportunity assignedToId and Account/Contact ownerId.
- Active ADMIN/SUPER_ADMIN users have unrestricted record scope.
- Explicit User.managerId reporting lines include direct and indirect reports. No profile-name inference or access through missing manager relationships. Cycles terminate.
- Deactivated/missing/unauthenticated users receive an empty scope.
- Main four object list/detail pages and list/detail APIs apply scope.
- Global search and matching record action subroutes check scope.
- Generic bulk operations on these objects apply scope; non-admin bulk operations on other objects are denied pending an explicit ownership policy.
- Existing session roles/permissions refresh, opportunity action permissions, and separate bulk Delete authorization are part of the same local change set.

## Required before production rollout

- Verify production managerId completeness against intended teams; do not infer teams from names.
- Filter nested related-record payloads and related lists: scoping a parent alone is insufficient.
- Deploy and verify the report/dashboard extension; cover future exports, dialer, alternate lookup endpoints and service-driven reads/writes.
- Define sharing for tasks, cases, documents, clients, financial objects and queues.
- Verify reassignment rights and race-safe action authorization.
- Exercise restricted users against live-equivalent fixture data and test all bypass paths.
- Measure per-request authorization query cost and consolidate redundant user/team reads without stale access.
- Complete recoverable deletion and transactional audit coverage.

## Verification so far

53 targeted tests pass, including reporting-tree isolation, admin/deactivated behavior, direct inline-edit denial, object action authorization, session refresh, SSN privacy/reveal and contact identity regression tests. TypeScript passed. Production webpack build is run after the current changes; default Turbopack is incompatible with this temporary worktree's external node_modules symlink.
