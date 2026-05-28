# Salesforce Parity Roadmap

> **For agentic workers:** This is the master roadmap. Each phase has its own detailed plan to execute.

**Goal:** Bring the Coastal CRM (`crm-production-613a.up.railway.app`, `barcoastal/CRM`) to full parity with the existing Salesforce org (`Yati LLC`), so Salesforce can be retired.

**Architecture:** Next.js 16 App Router + Prisma 7 + Postgres + next-auth v5. Existing models (Lead, Opportunity, Client, Debt, Negotiation, Payment, Document, Call, Campaign) get expanded and broken apart to match Salesforce's data shape. No data migration — prod DB is nuked between phases.

**Source of truth for Salesforce features:** `/Users/baralezrah/Desktop/salesforce-scan/REQUIREMENTS.md` and `raw/*.json`.

---

## Phase plan

Each phase ships a working end-to-end app (break-and-fix-as-we-go). Phases land in order; each gets its own detailed plan written just-in-time so decisions in earlier phases inform later ones.

| # | Phase | Plan doc | Scope |
|---|---|---|---|
| 1 | **Foundation** | [`2026-05-28-phase-1-foundation.md`](./2026-05-28-phase-1-foundation.md) | Roles, Profiles, PermissionSets, Groups/Queues, AuditLog, ApplicationLog, AsyncOperation. Vitest test infra. Role-based middleware. |
| 2 | **Core entities + record types** | TBD | Split Lead into Account+Contact+Lead with record types. Opportunity with 4 record types. Creditor entity. Lead→Account+Contact+Opp conversion. |
| 3 | **Debt operations domain** | TBD | ProgramPlan, DebitSchedule, Draft (ACH retries), Offer, Settlement, Fee, PaymentProcessor, PaymentSummary, FinancialSummary. Refactor existing Debt + Payment + Negotiation models. |
| 4 | **Activities** | TBD | Task + Event with disposition record types. Generalize Call as a Task subtype. Callbacks, reminders, meetings. |
| 5 | **Case management** | TBD | Case with 4 record types. L1/L2/L3 queues + escalation. Skip-payment case automation. Approvals. |
| 6 | **Communications + integrations** | TBD | EmailMessage log, SMS log, Email templates. Five9/Telnyx/DocuSign/Pardot integration scaffolding. Inbound webhook endpoints (PaymentProcessor, LeadImport, OptoutEmail, CreditorPortal, UpdateAdClickId). |
| 7 | **Automation + polish** | TBD | Cadences (Welcome Call, Contract Signed). DNC/Suppression list mgmt. Field history tracking. Background job runner (replaces `relax__`). Report builder integration. |

---

## Cross-cutting decisions (apply to all phases)

**Data discard policy:** Prod DB is nuked between phases. Migrations are squashed at the start of each phase (delete `prisma/migrations/`, run `prisma migrate dev --name <phase>` fresh). No rollback. No backwards compat.

**Testing:** Vitest. Business-logic tests are required (permission resolver, queue routing, audit middleware, conversion flows, draft retry state machine). Pure-data Prisma models don't need tests.

**Permission system:** Salesforce's profile + permission-set + permission-set-group model is preserved exactly. A user has **one Profile** + **N PermissionSets** (directly or via PermissionSetGroups). Effective permissions = Profile ∪ (every assigned PermSet). Permissions are checked via `hasPermission(user, 'OBJECT.ACTION')` in API routes and `requirePermission()` in middleware.

**Record types:** Implemented as a `recordType` enum field per object + record-type-specific validation in Zod schemas. The new CRM does NOT need separate page layouts per record type at the API level — UI handles that.

**Audit log:** Every write through Prisma goes through an audit-logging wrapper that records (entity, entityId, userId, action, before, after, createdAt). Read-only access for compliance review.

**Naming:** Use camelCase Prisma model names without `__c` suffix. E.g. `Debt`, not `Debt_C`. Keep model names short, plural collection endpoints (`/api/debts`).

**Deploy cadence:** Each phase ends with `git push origin main` to trigger Railway deploy + a fresh `prisma migrate deploy && prisma db seed` against prod.

---

## Out of scope (do NOT build)

- DevOps tooling: Copado, sf_devops (was for Salesforce CI/CD)
- Data archival: Grax (use Postgres backups instead)
- Salesforce-specific analytics (B2BMA, SalesforceIQ, Sales Insights, Analytics Cloud)
- Pardot internal model (just integration hooks)
- SMS-Magic's 80 custom objects (just outbound SMS log)
- Multi-currency, multi-language (single-currency USD, single-language English)
- Marketing automation builder (use Klaviyo/HubSpot for that; CRM just sends events)

---

## Next step

Execute **Phase 1: Foundation** — plan at [`2026-05-28-phase-1-foundation.md`](./2026-05-28-phase-1-foundation.md).
