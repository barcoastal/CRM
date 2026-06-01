# Phase 5: Case Management

**Goal:** Build the CSA support ticket system. Cases capture client issues (failed draft, skip payment, cancellation request, document needs) and route them through L1/L2/L3 queues with escalation + approval flows.

**Non-goals:** Email-to-Case auto-creation (Phase 6 with EmailMessage model). Full approval-process builder (we add a simpler `requiresApproval` flag per case). Case auto-routing rules engine (we expose manual assignment; routing rules later).

---

## Schema additions

```prisma
model Case {
  id           String   @id @default(cuid())
  caseNumber   String   @unique           // human-friendly: "C-0001"
  recordType   String   @default("SUPPORT") // SUPPORT | PAYMENT_ISSUE | SKIP_PAYMENT | CANCELLATION | BANK_UPDATE | DOCUMENT_REQUEST
  subject      String
  description  String?
  status       String   @default("NEW")  // NEW | OPEN | IN_PROGRESS | WAITING_ON_CUSTOMER | ESCALATED | RESOLVED | CLOSED
  priority     String   @default("NORMAL") // LOW | NORMAL | HIGH | URGENT
  origin       String   @default("PHONE") // PHONE | EMAIL | WEB | CHAT | OTHER
  escalationLevel String @default("L1")   // L1 | L2 | L3

  // Polymorphic "what"
  accountId      String?
  account        Account?     @relation("AccountCases", fields: [accountId], references: [id])
  contactId      String?
  contact        Contact?     @relation("ContactCases", fields: [contactId], references: [id])
  programPlanId  String?
  programPlan    ProgramPlan? @relation("ProgramPlanCases", fields: [programPlanId], references: [id])
  draftId        String?
  draft          Draft?       @relation("DraftCases", fields: [draftId], references: [id])

  // Ownership: either a user OR a queue
  ownerId       String?
  owner         User?    @relation("CaseOwner", fields: [ownerId], references: [id])
  ownerGroupId  String?
  ownerGroup    Group?   @relation("CaseOwnerGroup", fields: [ownerGroupId], references: [id])

  parentCaseId String?
  parentCase   Case?   @relation("CaseHierarchy", fields: [parentCaseId], references: [id])
  childCases   Case[]  @relation("CaseHierarchy")

  // Approval — simple flag-based until Phase 7 ApprovalProcess
  requiresApproval Boolean  @default(false)
  approvedById     String?
  approvedBy       User?    @relation("CaseApprover", fields: [approvedById], references: [id])
  approvedAt       DateTime?
  approvalNotes    String?

  // SLA
  slaDueAt      DateTime?
  firstResponseAt DateTime?
  resolvedAt    DateTime?
  closedAt      DateTime?

  createdById   String?
  createdBy     User?    @relation("CaseCreatedBy", fields: [createdById], references: [id])

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  comments     CaseComment[]
  tasks        Task[]      @relation("CaseTasks")
  events       Event[]     @relation("CaseEvents")

  @@index([status])
  @@index([ownerId])
  @@index([ownerGroupId])
  @@index([accountId])
  @@index([recordType])
}

model CaseComment {
  id          String   @id @default(cuid())
  caseId      String
  case        Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  authorId    String?
  author      User?    @relation("CaseCommentAuthor", fields: [authorId], references: [id])
  body        String
  isInternal  Boolean  @default(true)   // internal note vs. customer-visible
  createdAt   DateTime @default(now())

  @@index([caseId, createdAt])
}
```

### Modifications

- `Account`, `Contact`, `ProgramPlan`, `Draft` — add inverse `cases Case[]`
- `Task`, `Event` — add `caseId String?` + relation so case-related work can be attached
- `User` — add inverse `casesOwned`, `casesCreated`, `casesApproved`, `caseComments`
- `Group` — add inverse `casesAsOwner Case[]`

### Case-number generation

Atomic via a tiny counter table or by using max(caseNumber)+1 inside a transaction. Format: `C-0001`. We'll use a simple count-based approach in a Prisma transaction (fine for low write rates).

---

## File map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add Case + CaseComment, modify Task/Event/User/Group |
| `src/lib/record-types.ts` | CASE_RECORD_TYPES, CASE_STATUSES, ESCALATION_LEVELS |
| `src/lib/cases.ts` | escalateCase + assignCaseToQueue + closeCase + nextCaseNumber + computed SLA helper |
| `src/lib/skip-payment.ts` | createSkipPaymentCase: case + cancel next SCHEDULED Draft transactionally |
| `src/lib/validations/case.ts` | Zod |
| `src/lib/validations/case-comment.ts` | Zod |
| `src/app/api/cases/route.ts` | GET list + POST create |
| `src/app/api/cases/[id]/route.ts` | GET / PATCH |
| `src/app/api/cases/[id]/comments/route.ts` | GET list + POST create |
| `src/app/api/cases/[id]/escalate/route.ts` | POST → bump escalationLevel + reassign queue |
| `src/app/api/cases/[id]/assign/route.ts` | POST → set ownerId or ownerGroupId |
| `src/app/api/cases/[id]/close/route.ts` | POST → status RESOLVED/CLOSED + resolvedAt/closedAt |
| `src/app/api/cases/[id]/approve/route.ts` | POST → set approvedById/approvedAt |
| `src/app/api/skip-payment/route.ts` | POST → invoke createSkipPaymentCase helper |
| `prisma/seed.ts` | 4 sample cases across statuses + queues |
| `tests/lib/cases.test.ts` | escalation level math + close idempotency |

---

## Execution order

1. Schema
2. Record-type + status enums
3. `cases.ts` + `skip-payment.ts` + tests
4. Validations
5. Endpoints
6. Seed
7. Push + Railway redeploy + reseed

---

## What we do NOT do this phase

- Email-to-Case
- Live SLA alerts / breach notifications
- Auto-routing engine
- Customer-portal comment exposure
- Approval-process builder
- Case auto-close after N days idle
