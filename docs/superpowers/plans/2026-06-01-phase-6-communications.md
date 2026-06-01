# Phase 6: Communications + Integrations

**Goal:** Capture every email and SMS the team sends or receives, store reusable templates, and stub the integration layer so Five9/Telnyx/DocuSign/Pardot can plug in without schema changes. Add public webhook endpoints (payment processor, lead import, opt-out, ad-click attribution) so external systems can push into the CRM.

**Non-goals:** Real provider integration code (just adapter stubs + credential storage). Inbox sync / IMAP polling. Mass-send queue runner (drafts/queues handled by the existing AsyncOperation pattern). Email-to-Case (separate flow, future). Per-message attachment storage (use ContentDocument from later phase).

---

## Schema additions (5 models)

```prisma
model EmailMessage {
  id           String   @id @default(cuid())
  direction    String   @default("OUTBOUND") // INBOUND | OUTBOUND
  status       String   @default("DRAFT")    // DRAFT | QUEUED | SENT | DELIVERED | OPENED | CLICKED | BOUNCED | COMPLAINED | FAILED
  fromAddress  String
  toAddresses  String                        // CSV
  cc           String?
  bcc          String?
  subject      String
  bodyText     String?
  bodyHtml     String?
  templateId   String?
  template     EmailTemplate? @relation(fields: [templateId], references: [id])

  // Polymorphic
  accountId     String?
  account       Account?     @relation("AccountEmails", fields: [accountId], references: [id])
  contactId     String?
  contact       Contact?     @relation("ContactEmails", fields: [contactId], references: [id])
  leadId        String?
  lead          Lead?        @relation("LeadEmails", fields: [leadId], references: [id])
  opportunityId String?
  opportunity   Opportunity? @relation("OpportunityEmails", fields: [opportunityId], references: [id])
  caseId        String?
  case          Case?        @relation("CaseEmails", fields: [caseId], references: [id])

  ownerId       String?
  owner         User?    @relation("EmailOwner", fields: [ownerId], references: [id])

  // Provider tracking
  providerMessageId String?
  provider          String?  // sendgrid | postmark | mailgun | smtp
  errorReason       String?

  // Timestamps
  sentAt       DateTime?
  deliveredAt  DateTime?
  openedAt     DateTime?
  clickedAt    DateTime?
  bouncedAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([direction])
  @@index([accountId])
  @@index([leadId])
  @@index([caseId])
}

model SmsMessage {
  id           String   @id @default(cuid())
  direction    String   @default("OUTBOUND") // INBOUND | OUTBOUND
  status       String   @default("QUEUED")   // QUEUED | SENT | DELIVERED | FAILED | RECEIVED
  fromNumber   String
  toNumber     String
  body         String
  segments     Int      @default(1)

  // Polymorphic
  accountId String?
  account   Account?  @relation("AccountSms", fields: [accountId], references: [id])
  contactId String?
  contact   Contact?  @relation("ContactSms", fields: [contactId], references: [id])
  leadId    String?
  lead      Lead?     @relation("LeadSms", fields: [leadId], references: [id])
  caseId    String?
  case      Case?     @relation("CaseSms", fields: [caseId], references: [id])

  ownerId   String?
  owner     User?   @relation("SmsOwner", fields: [ownerId], references: [id])

  providerMessageId String?
  provider          String?  // twilio | telnyx | smsmagic
  errorReason       String?
  errorCode         String?

  sentAt      DateTime?
  deliveredAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([accountId])
  @@index([leadId])
}

model EmailTemplate {
  id           String   @id @default(cuid())
  name         String   @unique
  developerName String  @unique
  subject      String                       // can include {{merge.fields}}
  bodyText     String?
  bodyHtml     String?
  description  String?
  folder       String?  @default("General")
  isActive     Boolean  @default(true)
  createdById  String?
  createdBy    User?    @relation("EmailTemplateAuthor", fields: [createdById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  emails EmailMessage[]
}

model IntegrationCredential {
  id            String   @id @default(cuid())
  provider      String                       // FIVE9 | TWILIO | TELNYX | DOCUSIGN | PARDOT | KLAVIYO | SENDGRID
  name          String                       // human label, e.g. "Primary Twilio account"
  isActive      Boolean  @default(true)
  config        Json                         // provider-specific shape: { accountSid, authToken, ... }
  scopes        String?                      // CSV of usage scopes
  rotatedAt     DateTime?
  createdById   String?
  createdBy     User?    @relation("IntegrationCredentialAuthor", fields: [createdById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([provider, name])
  @@index([provider, isActive])
}

model WebhookEvent {
  id           String   @id @default(cuid())
  source       String                       // PAYMENT_PROCESSOR | LEAD_IMPORT | OPT_OUT | AD_CLICK | TWILIO | SENDGRID
  endpoint     String                       // route path that received it
  ipAddress    String?
  headers      Json?
  payload      Json?
  signature    String?
  signatureValid Boolean?
  status       String   @default("RECEIVED") // RECEIVED | PROCESSED | FAILED | IGNORED
  resultNote   String?
  processedAt  DateTime?

  createdAt DateTime @default(now())

  @@index([source, status])
  @@index([createdAt])
}
```

### Modifications

- `Account`, `Contact`, `Lead`, `Opportunity`, `Case` — inverse `emails / sms` relations
- `User` — inverse `emailsOwned / smsOwned / emailTemplates / integrationCredentials`

---

## File map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add 5 models + inverse relations |
| `src/lib/record-types.ts` | EMAIL_STATUSES, SMS_STATUSES, INTEGRATION_PROVIDERS |
| `src/lib/template-render.ts` | Pure renderer for `{{merge.fields}}` |
| `src/lib/validations/email-message.ts` | Zod |
| `src/lib/validations/sms-message.ts` | Zod |
| `src/lib/validations/email-template.ts` | Zod |
| `src/lib/validations/integration-credential.ts` | Zod |
| `src/app/api/emails/route.ts` | GET/POST (POST creates a queued/sent EmailMessage; no real provider call yet) |
| `src/app/api/emails/[id]/route.ts` | GET/PATCH |
| `src/app/api/sms/route.ts` | GET/POST |
| `src/app/api/sms/[id]/route.ts` | GET/PATCH |
| `src/app/api/email-templates/route.ts` | GET/POST |
| `src/app/api/email-templates/[id]/route.ts` | GET/PATCH |
| `src/app/api/integrations/route.ts` | GET/POST (admin-only) |
| `src/app/api/integrations/[id]/route.ts` | GET/PATCH |
| `src/app/api/webhooks/payment-processor/route.ts` | POST — record event, update Draft on status callback |
| `src/app/api/webhooks/lead-import/route.ts` | POST — record event, create Lead from external payload |
| `src/app/api/webhooks/opt-out/route.ts` | POST — record event, mark Lead/Contact DNC |
| `src/app/api/webhooks/ad-click/route.ts` | POST — record event (we just store; cross-ref Lead happens in attribution job later) |
| `prisma/seed.ts` | Sample emails, sms, 3 email templates, 2 integration credentials, 1 webhook event |
| `tests/lib/template-render.test.ts` | Renderer tests |

---

## Execution order

1. Schema → `prisma generate`
2. Record-types extension
3. Template renderer + tests
4. Validations
5. Endpoints (messages + templates + integrations)
6. Webhook routes (public — `x-webhook-secret` header check)
7. Seed
8. Push + redeploy + curl `/api/debug/seed`

---

## Webhook auth model

Each webhook endpoint checks an env var unique to that source:
- `PAYMENT_PROCESSOR_WEBHOOK_SECRET`
- `LEAD_IMPORT_API_KEY`
- `OPT_OUT_WEBHOOK_SECRET`
- `AD_CLICK_WEBHOOK_SECRET`

Caller passes the secret in an `x-webhook-secret` header. We always log the WebhookEvent (signatureValid flag) regardless of validity for security auditing.

---

## What we do NOT do this phase

- Real provider API calls (Twilio.send, SendGrid.send, etc.) — that's wired with credentials in Phase 2.5 / further deploys
- IMAP / inbox polling
- Email-to-Case routing
- Bulk-send queue runner (use existing AsyncOperation for jobs)
- Attachment storage (deferred — ContentDocument needs separate phase)
- Per-merge-field validation (template renderer is intentionally permissive)

---

## Definition of done

- [ ] `prisma db push` applies on Railway
- [ ] 5 new endpoints (emails, sms, templates, integrations, webhooks) return correct status codes
- [ ] Template renderer correctly resolves `{{contact.firstName}}` etc. via test
- [ ] Webhook endpoints log every event (valid + invalid signatures)
- [ ] Seed creates sample emails + 3 templates + 1 Twilio credential (encrypted-ish — config is Json)
- [ ] All vitest tests pass; target ≥90 after Phase 6
