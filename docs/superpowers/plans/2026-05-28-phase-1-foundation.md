# Phase 1: Foundation — Permissions, Queues, Audit Infrastructure

**Goal:** Build the foundation Salesforce's profile/permset/role/queue model sits on, plus auditable logging. Existing app keeps working with `role` strings until Phase 2 swaps them out.

**Out of scope this phase:** Account/Contact split, record types, debt domain refactor — all later phases.

---

## What changes

### New Prisma models

```
Role                — 16 hierarchy roles (CEO, VP Sales, Sales Mgr, Closer, …)
Profile             — 60 profiles (System Admin, Closer, CSA, Debt Negotiator, …)
PermissionSet       — fine-grained capability bundles (e.g. "Export Reports")
PermissionSetGroup  — bundles of perm sets ("Closers PSG")
PermissionSetGroupItem — junction (group ↔ permset)
UserPermissionSet   — junction (user ↔ permset, direct assignment)
Group               — sf-style Group/Queue (Type: Queue | Role | PublicGroup)
GroupMember         — junction (group ↔ user, polymorphic later)
Queue               — view onto Group where type='Queue' (we'll just filter)
AuditLog            — every write captured
ApplicationLog      — structured app/error log (replaces console.log spam)
AsyncOperation      — track long-running jobs (replaces relax__)
```

### User model gains

```
profileId      String?  @relation Profile
roleId         String?  @relation Role (hierarchy)
managerId      String?  // direct manager (separate from role hierarchy)
lastLoginAt    DateTime?
permissionSets UserPermissionSet[]
```

`role` (string field) stays for one phase to avoid breaking the world.

### New lib modules

- `src/lib/permissions.ts` — `hasPermission(user, key)`, `requirePermission(key)`, permission catalog
- `src/lib/queues.ts` — `assignToQueue(entity, queueDevName)`, `dequeue(queueDevName, userId)`
- `src/lib/audit.ts` — `auditWrite(action, before, after)` wrapper
- `src/lib/app-log.ts` — `logInfo/logWarn/logError(source, message, payload)`
- `src/lib/async-op.ts` — `createAsyncOp(type, payload)`, `completeAsyncOp(id, result)`, `failAsyncOp(id, error)`

### Middleware

Add per-route permission checks via matcher → `requirePermission` map.

### Seed data

- 16 roles (full SF hierarchy)
- 12 condensed profiles (collapsing the 60 SF profiles into business-relevant set)
- ~30 permission sets (Coastal-relevant subset of the 94)
- 10 queues (mirror SF queues exactly)
- 5 sample users covering main personas (Admin, Sales Mgr, Closer, CSA, Negotiator)

---

## File map

| File | Action | Purpose |
|---|---|---|
| `vitest.config.ts` | Create | Vitest setup |
| `tests/setup.ts` | Create | Test env + per-test DB reset |
| `package.json` | Modify | Add vitest, @vitest/coverage-v8, test scripts |
| `prisma/schema.prisma` | Modify | Append new models, modify User |
| `prisma/seed.ts` | Rewrite | Seed roles/profiles/permsets/queues + sample users |
| `src/lib/permissions.ts` | Create | Permission resolver + catalog |
| `src/lib/queues.ts` | Create | Queue assignment helpers |
| `src/lib/audit.ts` | Create | Audit log wrapper |
| `src/lib/app-log.ts` | Create | Structured logging |
| `src/lib/async-op.ts` | Create | Async operation tracking |
| `src/lib/auth.ts` | Modify | Load effective permissions into session |
| `src/middleware.ts` | Modify | Per-route permission check |
| `src/types/next-auth.d.ts` | Create | Type-augment Session with permissions/profile |
| `tests/lib/permissions.test.ts` | Create | Test hasPermission resolver |
| `tests/lib/queues.test.ts` | Create | Test queue assignment |
| `tests/lib/audit.test.ts` | Create | Test audit log capture |

---

## Execution order

1. **Vitest infra** — test runner + first passing test
2. **Schema additions** — Role, Profile, PermSet, PermSetGroup, junctions, Group, AuditLog, AppLog, AsyncOp + User changes
3. **Migration** — nuke `prisma/migrations/`, run `prisma migrate dev --name phase1_foundation`
4. **Permissions module** — catalog + resolver + tests
5. **Queues module** — helpers + tests
6. **Audit module** — wrapper + tests
7. **AppLog + AsyncOp modules** — direct CRUD, minimal tests
8. **Auth update** — load profile + effective perm keys into JWT/session
9. **Middleware update** — permission check per matcher
10. **Seed rewrite** — 16 roles, 12 profiles, 30 perm sets, 10 queues, 5 users
11. **Local verify** — login as each persona, hit protected routes, confirm 403/200 correctly
12. **Deploy** — push main, `prisma migrate deploy && prisma db seed` on Railway

---

## Tests we WILL write

- `permissions.test.ts` — Profile + permset union, group expansion, missing perm = false
- `queues.test.ts` — assign, dequeue (FIFO), member-only dequeue
- `audit.test.ts` — write captures before/after, userId from session
- One end-to-end auth test — login → session has permissions

## Tests we will NOT write

- Prisma model shape (declarative)
- Seed data exact counts (might churn)
- AppLog/AsyncOp CRUD (trivial)
