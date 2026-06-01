# Phase 2: Account / Contact split + Record types + Creditor

**Goal:** Bring the CRM's core entities to Salesforce shape. Today the model collapses everything into `Lead → Opportunity → Client`. Salesforce uses `Lead → Account (org) + Contact (person) + Opportunity` with **record types** that gate different behavior per product/segment.

**Why this phase is foundational:** Phases 3 (debt ops), 5 (cases), and 6 (communications) all FK to Account/Contact. Doing this first prevents painful refactors later.

---

## What changes

### New Prisma models

```
Account                — organization or person (matches SF Account with PersonAccount enabled)
Contact                — a person attached to one or more Accounts
AccountContactRelation — junction (an org's people, with role)
Creditor               — specialized Account record-type-3, but modeled as its own entity for clean FKs from Debt
```

### Modified models

```
Lead         + recordType: WEB | DIRECT_MAIL | LIST | BUSINESS | ARCHIVED_WEB | ARCHIVED_DIRECT_MAIL | ARCHIVED_LIST
             — keeps businessName/contactName/phone for inbound capture
             — gains optional convertedAccountId / convertedContactId / convertedOpportunityId
Opportunity  + recordType: DEBT_SETTLEMENT | BUYOUT | RESTRUCTURE | LIMITED_ASSET_PROTECTION
             + accountId (FK to Account, replacing direct lead FK)
             + primaryContactId (FK to Contact)
             — lead relation becomes optional (post-conversion, opp is owned by Account)
Client       — DEPRECATED in favor of Account.status='CLIENT'; kept for one phase to avoid breaking UI
Debt         + creditorId (FK to Creditor, replacing creditorName string)
```

### Record type enums (stored as plain string columns, validated in Zod)

`Lead.recordType`: 7 values (matches SF Lead record types)
`Account.recordType`: 7 values — CLIENT, CREDITOR, VENDOR, BUSINESS_ACCOUNT, PERSON_ACCOUNT, BUYOUT, OTHER
`Opportunity.recordType`: 4 values — DEBT_SETTLEMENT, BUYOUT, RESTRUCTURE, LIMITED_ASSET_PROTECTION

---

## File map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add Account, Contact, AccountContactRelation, Creditor; modify Lead, Opportunity, Debt |
| `src/lib/record-types.ts` | Create | Centralized record-type enums + validators |
| `src/lib/lead-conversion.ts` | Create | `convertLead(leadId, opts)` → creates Account + Contact + Opp |
| `src/lib/validations/account.ts` | Create | Zod schemas (per record type) |
| `src/lib/validations/contact.ts` | Create | Zod schemas |
| `src/lib/validations/creditor.ts` | Create | Zod schemas |
| `src/lib/validations/lead.ts` | Modify | Add recordType; validate fields by record type |
| `src/lib/validations/opportunity.ts` | Modify | Add recordType; product-specific required fields |
| `src/app/api/accounts/route.ts` | Create | GET (list) + POST (create) |
| `src/app/api/accounts/[id]/route.ts` | Create | GET + PATCH + DELETE |
| `src/app/api/accounts/[id]/contacts/route.ts` | Create | List/add contacts on an account |
| `src/app/api/contacts/route.ts` | Create | GET + POST |
| `src/app/api/contacts/[id]/route.ts` | Create | GET + PATCH + DELETE |
| `src/app/api/creditors/route.ts` | Create | GET + POST |
| `src/app/api/creditors/[id]/route.ts` | Create | GET + PATCH + DELETE |
| `src/app/api/leads/[id]/convert/route.ts` | Create | POST → runs convertLead, returns IDs |
| `src/app/api/opportunities/route.ts` | Modify | Require recordType; FK to accountId |
| `src/app/api/leads/route.ts` | Modify | Accept recordType (defaults WEB) |
| `src/app/api/clients/[id]/debts/route.ts` | Modify | Accept creditorId instead of creditorName |
| `src/app/(dashboard)/accounts/page.tsx` | Create | Accounts list (filter by record type) |
| `src/app/(dashboard)/accounts/[id]/page.tsx` | Create | Account detail with related contacts/opps/debts |
| `src/app/(dashboard)/contacts/page.tsx` | Create | Contacts list |
| `src/app/(dashboard)/contacts/[id]/page.tsx` | Create | Contact detail |
| `src/app/(dashboard)/creditors/page.tsx` | Create | Creditors list |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Modify | Add "Convert" action; show convertedAccount/Contact/Opp links if converted |
| `src/app/(dashboard)/leads/new/page.tsx` | Modify | Record type selector |
| `src/app/(dashboard)/opportunities/new/page.tsx` | Create | Currently auto-created from Lead; add explicit create with Account picker + record type |
| `src/middleware.ts` | Modify | Add new routes to matcher |
| `src/components/app-sidebar.tsx` | Modify | Add Accounts / Contacts / Creditors nav items |
| `prisma/seed.ts` | Modify | Seed sample Accounts (3 clients, 2 creditors, 1 vendor), Contacts, Creditor records |
| `tests/lib/lead-conversion.test.ts` | Create | Pure-logic test of conversion mapping (with mocked Prisma) |
| `tests/lib/record-types.test.ts` | Create | Validator tests per record type |

---

## Schema details

```prisma
model Account {
  id                String   @id @default(cuid())
  recordType        String   @default("CLIENT")  // CLIENT | CREDITOR | VENDOR | BUSINESS_ACCOUNT | PERSON_ACCOUNT | BUYOUT | OTHER
  name              String                                   // org name OR person full name
  type              String   @default("ORG")                 // ORG | PERSON  (drives layout)
  ein               String?                                  // org only
  ssnLast4          String?                                  // person only
  phone             String?
  email             String?
  website           String?
  industry          String?
  annualRevenue     Float?
  numberOfEmployees Int?
  description       String?
  // billing/shipping
  billingStreet     String?
  billingCity       String?
  billingState      String?
  billingZip        String?
  billingCountry    String?   @default("US")
  // ownership
  ownerId           String?
  owner             User?    @relation("AccountOwner", fields: [ownerId], references: [id])
  parentAccountId   String?
  parentAccount     Account? @relation("AccountHierarchy", fields: [parentAccountId], references: [id])
  childAccounts     Account[] @relation("AccountHierarchy")
  // status
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  contacts          AccountContactRelation[]
  opportunities     Opportunity[]
  creditor          Creditor?
  client            Client?  // legacy until Client model retired
}

model Contact {
  id            String   @id @default(cuid())
  firstName     String
  lastName      String
  fullName      String   // derived, stored for sorting/search
  email         String?
  phone         String?
  mobilePhone   String?
  title         String?
  birthdate     DateTime?
  // primary account for default org context
  primaryAccountId String?
  primaryAccount   Account? @relation("PrimaryContactAccount", fields: [primaryAccountId], references: [id])
  ownerId       String?
  owner         User?    @relation("ContactOwner", fields: [ownerId], references: [id])
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  accountRelations AccountContactRelation[]
  primaryFor       Opportunity[]    @relation("OpportunityPrimaryContact")
}

model AccountContactRelation {
  id         String   @id @default(cuid())
  accountId  String
  account    Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  contactId  String
  contact    Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  role       String?  // "Owner" | "CFO" | "Authorized Rep" | "Spouse" | ...
  isDirect   Boolean  @default(true)   // direct contact vs. indirect (referral)
  createdAt  DateTime @default(now())

  @@unique([accountId, contactId])
}

model Creditor {
  id            String   @id @default(cuid())
  accountId     String   @unique
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  // Creditor-specific fields (Settlement performance, contact desk info)
  legalName     String
  collectionsPhone String?
  collectionsEmail String?
  settlementPolicy String?   // "Accepts 30%-50%" or freeform notes
  averageAcceptedPercent Float?    // rolling avg; updated by trigger later
  totalDebtsHandled      Int       @default(0)
  totalSettledAmount     Float     @default(0)
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  debts         Debt[]
}

model Lead {
  // existing fields preserved
  // ADD:
  recordType              String   @default("WEB")
  convertedAccountId      String?
  convertedAccount        Account? @relation("LeadConvertedAccount", fields: [convertedAccountId], references: [id])
  convertedContactId      String?
  convertedContact        Contact? @relation("LeadConvertedContact", fields: [convertedContactId], references: [id])
  convertedOpportunityId  String?  // already inferable via opportunity.leadId but explicit for fast lookup
  convertedAt             DateTime?
}

model Opportunity {
  // existing fields preserved
  // ADD:
  recordType        String   @default("DEBT_SETTLEMENT")
  accountId         String?
  account           Account? @relation(fields: [accountId], references: [id])
  primaryContactId  String?
  primaryContact    Contact? @relation("OpportunityPrimaryContact", fields: [primaryContactId], references: [id])
  // leadId stays nullable - leads optional post-conversion
}

model Debt {
  // existing fields preserved
  // ADD:
  creditorId        String?
  creditor          Creditor? @relation(fields: [creditorId], references: [id])
  // creditorName/Phone/Email stay for now; will deprecate after backfill
}
```

---

## Lead conversion flow

`POST /api/leads/{id}/convert` with body:

```json
{
  "accountRecordType": "BUSINESS_ACCOUNT" | "PERSON_ACCOUNT",
  "opportunityRecordType": "DEBT_SETTLEMENT" | "BUYOUT" | "RESTRUCTURE" | "LIMITED_ASSET_PROTECTION",
  "opportunityName": "Acme Construction — Debt Settlement",
  "accountOwnerId": "<userId>",
  "contactRole": "Owner",                   // optional, defaults "Primary Contact"
  "doNotCreateOpportunity": false           // optional
}
```

Server:
1. Loads lead, ensures `convertedAccountId IS NULL` (idempotent — re-running returns existing converted IDs)
2. Parses `lead.contactName` → first/last (best-effort split on space; UI can override)
3. Creates Account from `lead.businessName`, `lead.email`, `lead.phone`, `lead.industry`, `lead.annualRevenue`, `lead.ein`
4. Creates Contact from parsed names + `lead.email` + `lead.phone`
5. Creates AccountContactRelation linking the two with role
6. (If not skipped) Creates Opportunity owned by Account, primaryContact set, `recordType` from body, `totalDebt = lead.totalDebtEst`
7. Updates Lead: `convertedAccountId/ContactId/OpportunityId/At` + `status = 'ENROLLED'` (or 'CONVERTED' — add to enum)
8. Audit-logs each create via `auditWrite`

Returns: `{ accountId, contactId, opportunityId | null }`

---

## Execution order

1. **Schema diff** — extend `prisma/schema.prisma`; run `prisma generate`
2. **Record-type catalogs + validators** — `src/lib/record-types.ts` + Zod updates + tests
3. **Lead conversion** — `src/lib/lead-conversion.ts` + tests + endpoint
4. **Account/Contact/Creditor APIs** — list, detail, CRUD
5. **UI** — accounts/contacts/creditors list+detail pages; record-type selector on Lead create; Convert button on Lead detail
6. **Seed** — sample data with mixed record types
7. **Hit `/api/debug/schema-push`** then `/api/debug/seed` on Railway to apply
8. **Smoke** — convert a lead manually in the browser, verify Account/Contact/Opp links

---

## What we do NOT do this phase

- Retire the `Client` model (it stays alongside `Account.recordType='CLIENT'` for one phase)
- Backfill `Debt.creditorName` → `Debt.creditorId` (leave string fields, accept new debts use FK)
- Account team membership (`AccountTeamMember` — defer to a sharing-rules phase)
- Page layouts per record type (UI just shows/hides relevant fields based on record type — no formal layout system)
- Field history tracking (separate roadmap item)
- Approval processes (Phase 5 territory)

---

## Definition of done

- [ ] `prisma db push` applies cleanly on Railway
- [ ] Login works; new sidebar shows Accounts / Contacts / Creditors
- [ ] Create an Account → create a Contact → link them with a role
- [ ] Create a Lead with `recordType=WEB` → convert it → confirm Account + Contact + Opportunity all exist with expected record types
- [ ] Add a Debt to an Opportunity, picking from existing Creditors
- [ ] All vitest tests still pass (target: ≥45 tests total after Phase 2)
- [ ] Audit log captures conversion (verify in DB)
