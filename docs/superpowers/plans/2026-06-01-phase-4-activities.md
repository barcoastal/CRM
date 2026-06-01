# Phase 4: Activities — Task + Event

**Goal:** Add SF-style Task + Event records to capture every interaction the team has with a Lead/Account/Contact/Opportunity/Case/Debt. Powers the "what happened on this account?" timeline that closers, CSAs, and negotiators rely on daily.

**Non-goals:** Calendar sync (Google/Outlook) — separate phase. Attendee invitations. Recurring events. Email auto-logging from inbox (Phase 6).

**Design note:** SF uses a polymorphic `WhatId` (related record) + `WhoId` (person). Prisma doesn't do clean polymorphism — instead we use nullable FKs to each parent type (`accountId?`, `opportunityId?`, `caseId?` …). Same pattern Salesforce's underlying SOQL ends up with at the data-modeling layer.

---

## Schema additions

```prisma
model Task {
  id           String   @id @default(cuid())
  recordType   String   @default("ACTIVITY")  // ACTIVITY | DISPOSITION
  subject      String
  type         String   @default("TASK")      // CALL | EMAIL | LETTER | TASK | NOTE | OTHER
  status       String   @default("NOT_STARTED") // NOT_STARTED | IN_PROGRESS | COMPLETED | DEFERRED | WAITING
  priority     String   @default("NORMAL")    // LOW | NORMAL | HIGH

  // Polymorphic "what" — what does this task relate to?
  accountId      String?
  account        Account?     @relation("AccountTasks", fields: [accountId], references: [id])
  opportunityId  String?
  opportunity    Opportunity? @relation("OpportunityTasks", fields: [opportunityId], references: [id])
  debtId         String?
  debt           Debt?        @relation("DebtTasks", fields: [debtId], references: [id])
  programPlanId  String?
  programPlan    ProgramPlan? @relation("ProgramPlanTasks", fields: [programPlanId], references: [id])

  // Polymorphic "who" — which person
  leadId    String?
  lead      Lead?    @relation("LeadTasks", fields: [leadId], references: [id])
  contactId String?
  contact   Contact? @relation("ContactTasks", fields: [contactId], references: [id])

  // Ownership
  ownerId  String?
  owner    User?    @relation("TaskOwner", fields: [ownerId], references: [id])

  // Scheduling
  dueDate     DateTime?
  reminderAt  DateTime?
  completedAt DateTime?

  // Disposition-specific (when recordType=DISPOSITION)
  disposition   String?
  callbackDate  DateTime?
  outcome       String?
  // If this Task is the after-the-fact disposition of an actual Call
  callId        String?  @unique
  call          Call?    @relation(fields: [callId], references: [id])

  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId, status])
  @@index([dueDate])
  @@index([accountId])
  @@index([opportunityId])
  @@index([leadId])
  @@index([contactId])
}

model Event {
  id           String   @id @default(cuid())
  recordType   String   @default("EVENT")     // EVENT | EVENT_DISPOSITION
  subject      String
  description  String?
  location     String?
  status       String   @default("SCHEDULED") // SCHEDULED | COMPLETED | CANCELLED | NO_SHOW

  startAt      DateTime
  endAt        DateTime
  allDay       Boolean  @default(false)

  // Polymorphic relations (same shape as Task)
  accountId      String?
  account        Account?     @relation("AccountEvents", fields: [accountId], references: [id])
  opportunityId  String?
  opportunity    Opportunity? @relation("OpportunityEvents", fields: [opportunityId], references: [id])
  leadId         String?
  lead           Lead?        @relation("LeadEvents", fields: [leadId], references: [id])
  contactId      String?
  contact        Contact?     @relation("ContactEvents", fields: [contactId], references: [id])

  ownerId      String?
  owner        User?    @relation("EventOwner", fields: [ownerId], references: [id])

  // Disposition fields
  disposition  String?
  outcome      String?

  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([ownerId, status])
  @@index([startAt])
  @@index([accountId])
  @@index([opportunityId])
  @@index([leadId])
  @@index([contactId])
}
```

### Modifications to existing models

- `Account`, `Opportunity`, `Lead`, `Contact`, `Debt`, `ProgramPlan` — add inverse `tasks Task[]` and `events Event[]` relations
- `User` — add inverse `tasksOwned`, `eventsOwned`
- `Call` — add inverse `task Task?`

---

## File map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Task + Event + inverse relations |
| `src/lib/record-types.ts` | Modify | TASK_RECORD_TYPES + EVENT_RECORD_TYPES + isValid helpers |
| `src/lib/validations/task.ts` | Create | Zod |
| `src/lib/validations/event.ts` | Create | Zod |
| `src/app/api/tasks/route.ts` | Create | GET list (filter by related ids) + POST |
| `src/app/api/tasks/[id]/route.ts` | Create | GET / PATCH / DELETE |
| `src/app/api/tasks/[id]/complete/route.ts` | Create | POST → set status COMPLETED + completedAt |
| `src/app/api/events/route.ts` | Create | GET + POST |
| `src/app/api/events/[id]/route.ts` | Create | GET / PATCH / DELETE |
| `prisma/seed.ts` | Modify | Sample tasks (call to follow up Acme, callback for Sunrise), events (1 demo meeting) |
| `tests/lib/record-types.test.ts` | Modify | Add Task/Event record-type assertions |

---

## Execution order

1. Schema → `prisma generate`
2. Record-type extension + tests
3. Validations
4. Endpoints
5. Seed sample data
6. Push to main → seed via debug endpoint

---

## What we do NOT do this phase

- UI (sidebar tab, list pages, attach-to-record widgets) — Phase 4.x
- Recurring events / RRULE support
- iCalendar export
- Inbox sync
- Reminders/notifications (just stored — surfacing them is a notification-system phase)
- Multi-owner / attendees on events
- Task auto-completion when child Draft/Settlement state changes
