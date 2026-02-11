# Coastal CRM — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundation of Coastal CRM — a CRM + Power Dialer + AI Call Intelligence platform for business debt settlement firms.

**Architecture:** Next.js 14 App Router with server components and API routes. PostgreSQL via Prisma ORM for data. Mock telephony layer (Twilio-shaped interface) for dialer. Mock AI layer for transcription and coaching. WebSocket via Socket.io for real-time updates. TailwindCSS + shadcn/ui for the UI.

**Tech Stack:** Next.js 14, React 18, TypeScript, PostgreSQL, Prisma, TailwindCSS, shadcn/ui, Socket.io, BullMQ + Redis (dial queue), NextAuth.js (auth), Zod (validation)

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`
- Create: `prisma/schema.prisma`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.example`, `.gitignore`

**Step 1: Initialize Next.js project**

```bash
cd ~/debt-settlement-app
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This creates the full scaffold.

**Step 2: Install core dependencies**

```bash
npm install prisma @prisma/client next-auth @auth/prisma-adapter
npm install zod react-hook-form @hookform/resolvers
npm install socket.io socket.io-client
npm install bullmq ioredis
npm install date-fns libphonenumber-js
npm install -D @types/node
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input label table badge dialog select textarea tabs separator dropdown-menu avatar sheet toast sonner command popover calendar
```

**Step 4: Create .env.example**

Create `.env.example`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coastal_crm"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Copy to `.env`:
```bash
cp .env.example .env
```

**Step 5: Initialize Prisma**

```bash
npx prisma init
```

**Step 6: Initialize git and commit**

```bash
git init
git add .
git commit -m "feat: initialize Coastal CRM project scaffold"
```

---

## Task 2: Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Write the full Prisma schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ AUTH ============

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  passwordHash  String
  role          Role      @default(SALES_REP)
  avatar        String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  leads         Lead[]
  calls         Call[]
  campaigns     CampaignAgent[]
  callFeedbacks CallFeedback[]
}

enum Role {
  ADMIN
  MANAGER
  SALES_REP
  NEGOTIATOR
}

// ============ LEADS ============

model Lead {
  id              String      @id @default(cuid())
  businessName    String
  contactName     String
  phone           String
  email           String?
  ein             String?     @unique
  industry        String?
  annualRevenue   Decimal?    @db.Decimal(12, 2)
  totalDebtEst    Decimal?    @db.Decimal(12, 2)
  source          LeadSource  @default(OTHER)
  status          LeadStatus  @default(NEW)
  score           Int?        // AI-generated lead score 0-100
  scoreReason     String?     // AI explanation
  notes           String?
  lastContactedAt DateTime?
  nextFollowUpAt  DateTime?
  assignedToId    String?
  assignedTo      User?       @relation(fields: [assignedToId], references: [id])
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  calls           Call[]
  campaignContacts CampaignContact[]
}

enum LeadSource {
  WEBSITE
  REFERRAL
  MAILER
  PURCHASED_LIST
  COLD_CALL
  SOCIAL
  OTHER
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  UNQUALIFIED
  CALLBACK
  ENROLLED
  LOST
  DNC
}

// ============ CAMPAIGNS ============

model Campaign {
  id          String          @id @default(cuid())
  name        String
  description String?
  dialerMode  DialerMode      @default(POWER)
  status      CampaignStatus  @default(DRAFT)
  script      String?         // Call script / talk track
  startTime   String?         // Allowed calling start time "09:00"
  endTime     String?         // Allowed calling end time "20:00"
  timezone    String          @default("America/New_York")
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  contacts    CampaignContact[]
  agents      CampaignAgent[]
  calls       Call[]
}

enum DialerMode {
  POWER
  PREVIEW
  MANUAL
}

enum CampaignStatus {
  DRAFT
  ACTIVE
  PAUSED
  COMPLETED
}

model CampaignContact {
  id          String              @id @default(cuid())
  campaignId  String
  campaign    Campaign            @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  leadId      String
  lead        Lead                @relation(fields: [leadId], references: [id], onDelete: Cascade)
  status      CampaignContactStatus @default(PENDING)
  priority    Int                 @default(0)
  attempts    Int                 @default(0)
  lastAttempt DateTime?
  createdAt   DateTime            @default(now())

  @@unique([campaignId, leadId])
}

enum CampaignContactStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
  MAX_ATTEMPTS
}

model CampaignAgent {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@unique([campaignId, userId])
}

// ============ CALLS ============

model Call {
  id            String        @id @default(cuid())
  direction     CallDirection @default(OUTBOUND)
  status        CallStatus    @default(INITIATED)
  disposition   Disposition?
  leadId        String?
  lead          Lead?         @relation(fields: [leadId], references: [id])
  agentId       String
  agent         User          @relation(fields: [agentId], references: [id])
  campaignId    String?
  campaign      Campaign?     @relation(fields: [campaignId], references: [id])
  phoneNumber   String
  duration      Int?          // seconds
  recordingUrl  String?
  startedAt     DateTime      @default(now())
  answeredAt    DateTime?
  endedAt       DateTime?
  notes         String?
  createdAt     DateTime      @default(now())

  transcript    Transcript?
  feedback      CallFeedback?
}

enum CallDirection {
  INBOUND
  OUTBOUND
}

enum CallStatus {
  INITIATED
  RINGING
  IN_PROGRESS
  COMPLETED
  NO_ANSWER
  BUSY
  FAILED
  VOICEMAIL
}

enum Disposition {
  INTERESTED
  NOT_INTERESTED
  CALLBACK
  NOT_QUALIFIED
  WRONG_NUMBER
  VOICEMAIL
  NO_ANSWER
  DNC
  ENROLLED
}

// ============ AI: TRANSCRIPTION ============

model Transcript {
  id        String   @id @default(cuid())
  callId    String   @unique
  call      Call     @relation(fields: [callId], references: [id], onDelete: Cascade)
  content   Json     // Array of { speaker, text, timestamp }
  summary   String?  // AI-generated call summary
  keywords  String[] // Detected keywords
  sentiment String?  // positive, negative, neutral
  createdAt DateTime @default(now())
}

// ============ AI: CALL FEEDBACK ============

model CallFeedback {
  id                String   @id @default(cuid())
  callId            String   @unique
  call              Call     @relation(fields: [callId], references: [id], onDelete: Cascade)
  agentId           String
  agent             User     @relation(fields: [agentId], references: [id])
  overallScore      Int      // 0-100
  talkRatio         Float?   // agent talk time / total time
  objectionHandling Int?     // 0-100
  closingAttempt    Boolean?
  keyMoments        Json?    // Array of { timestamp, type, description }
  improvements      String[] // AI suggestions
  strengths         String[] // What went well
  createdAt         DateTime @default(now())
}
```

**Step 2: Create the database and run migration**

```bash
npx prisma migrate dev --name init
```

**Step 3: Generate Prisma client**

```bash
npx prisma generate
```

**Step 4: Create seed file**

Create `prisma/seed.ts`:
```typescript
import { PrismaClient, Role, LeadSource, LeadStatus } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create users
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@coastalcrm.com',
      passwordHash: await hash('password123', 12),
      role: Role.ADMIN,
    },
  })

  const salesRep = await prisma.user.create({
    data: {
      name: 'John Sales',
      email: 'john@coastalcrm.com',
      passwordHash: await hash('password123', 12),
      role: Role.SALES_REP,
    },
  })

  const manager = await prisma.user.create({
    data: {
      name: 'Sarah Manager',
      email: 'sarah@coastalcrm.com',
      passwordHash: await hash('password123', 12),
      role: Role.MANAGER,
    },
  })

  // Create sample leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        businessName: 'Acme Construction LLC',
        contactName: 'Bob Johnson',
        phone: '+15551234567',
        email: 'bob@acmeconstruction.com',
        ein: '12-3456789',
        industry: 'Construction',
        annualRevenue: 850000,
        totalDebtEst: 125000,
        source: LeadSource.WEBSITE,
        status: LeadStatus.NEW,
        score: 85,
        scoreReason: 'High debt-to-revenue ratio, active business, responsive to outreach',
        assignedToId: salesRep.id,
      },
    }),
    prisma.lead.create({
      data: {
        businessName: 'Sunrise Restaurant Group',
        contactName: 'Maria Garcia',
        phone: '+15559876543',
        email: 'maria@sunrisegroup.com',
        ein: '98-7654321',
        industry: 'Food Service',
        annualRevenue: 420000,
        totalDebtEst: 78000,
        source: LeadSource.REFERRAL,
        status: LeadStatus.CONTACTED,
        score: 72,
        scoreReason: 'Moderate debt, seasonal business, showed interest in consultation',
        assignedToId: salesRep.id,
        lastContactedAt: new Date('2026-02-10'),
        nextFollowUpAt: new Date('2026-02-13'),
      },
    }),
    prisma.lead.create({
      data: {
        businessName: 'Metro Auto Repair',
        contactName: 'James Williams',
        phone: '+15555551234',
        email: 'james@metroauto.com',
        industry: 'Automotive',
        annualRevenue: 310000,
        totalDebtEst: 95000,
        source: LeadSource.MAILER,
        status: LeadStatus.NEW,
        score: 68,
        scoreReason: 'Good debt amount, stable industry, no prior contact',
        assignedToId: salesRep.id,
      },
    }),
    prisma.lead.create({
      data: {
        businessName: 'Brightside Landscaping',
        contactName: 'Tom Peters',
        phone: '+15553334444',
        email: 'tom@brightsidelandscaping.com',
        industry: 'Landscaping',
        annualRevenue: 190000,
        totalDebtEst: 42000,
        source: LeadSource.COLD_CALL,
        status: LeadStatus.QUALIFIED,
        score: 91,
        scoreReason: 'Ready to enroll, has documentation ready, motivated',
        assignedToId: salesRep.id,
        lastContactedAt: new Date('2026-02-09'),
        nextFollowUpAt: new Date('2026-02-11'),
      },
    }),
    prisma.lead.create({
      data: {
        businessName: 'Downtown Dental Practice',
        contactName: 'Dr. Lisa Chen',
        phone: '+15556667777',
        email: 'lisa@downtowndental.com',
        industry: 'Healthcare',
        annualRevenue: 620000,
        totalDebtEst: 210000,
        source: LeadSource.PURCHASED_LIST,
        status: LeadStatus.NEW,
        score: 78,
        scoreReason: 'High debt amount, professional practice, good revenue',
      },
    }),
  ])

  // Create a campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: 'February New Lead Blitz',
      description: 'Outreach to all new leads from January/February',
      dialerMode: 'POWER',
      status: 'ACTIVE',
      script: `Hi, this is {agent_name} from Coastal Debt Solutions. I'm reaching out because we help businesses like {business_name} reduce their outstanding debt — often by 40-60%.

I see you may have around {debt_estimate} in business debt. We've helped companies in the {industry} space settle for significantly less.

Would you be open to a quick 10-minute consultation to see if we can help?

[IF INTERESTED] Great! Let me ask a few quick questions...
- What types of debt are you dealing with? (loans, credit lines, vendor debt, tax)
- Are you current on payments or have some fallen behind?
- What's your approximate monthly revenue?

[IF OBJECTION: "Not interested"]
I completely understand. Just so you know, there's no cost for the initial analysis. We only charge if we actually save you money. Would it hurt to at least see what's possible?

[IF OBJECTION: "Too expensive"]
Our fees are based on performance — we only get paid when we save you money. Most clients see 40-60% reduction in their total debt. The savings far outweigh our fees.`,
      startTime: '09:00',
      endTime: '18:00',
      contacts: {
        create: leads.map((lead, index) => ({
          leadId: lead.id,
          priority: leads.length - index,
        })),
      },
      agents: {
        create: [{ userId: salesRep.id }],
      },
    },
  })

  console.log('Seed complete!')
  console.log(`  Users: ${3}`)
  console.log(`  Leads: ${leads.length}`)
  console.log(`  Campaign: ${campaign.name}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Add to `package.json`:
```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

Install bcryptjs and tsx:
```bash
npm install bcryptjs
npm install -D @types/bcryptjs tsx
```

Run seed:
```bash
npx prisma db seed
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add database schema and seed data for Coastal CRM"
```

---

## Task 3: Authentication & Layout

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/topbar.tsx`
- Create: `src/components/user-nav.tsx`

**Step 1: Create Prisma singleton**

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 2: Set up NextAuth**

Create `src/lib/auth.ts` with credentials provider using email/password against User table.

**Step 3: Build login page**

Simple email + password form, redirects to `/dashboard` on success.

**Step 4: Build dashboard layout**

Sidebar navigation with:
- Dashboard (home)
- Leads
- Dialer
- Campaigns
- Calls
- Reports

Topbar with user avatar, role badge, and logout.

Responsive — sidebar collapses on mobile.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add authentication and dashboard layout"
```

---

## Task 4: Lead Management CRM

**Files:**
- Create: `src/app/(dashboard)/leads/page.tsx` — leads list with filters
- Create: `src/app/(dashboard)/leads/[id]/page.tsx` — lead detail
- Create: `src/app/(dashboard)/leads/new/page.tsx` — create lead form
- Create: `src/app/api/leads/route.ts` — GET (list), POST (create)
- Create: `src/app/api/leads/[id]/route.ts` — GET, PATCH, DELETE
- Create: `src/components/leads/lead-table.tsx`
- Create: `src/components/leads/lead-form.tsx`
- Create: `src/components/leads/lead-detail-card.tsx`
- Create: `src/components/leads/lead-pipeline.tsx`
- Create: `src/components/leads/lead-score-badge.tsx`
- Create: `src/lib/validations/lead.ts` — Zod schemas

**Step 1: Create API routes**

- `GET /api/leads` — list with pagination, search, filter by status/source/assignee
- `POST /api/leads` — create new lead with Zod validation
- `GET /api/leads/[id]` — get single lead with calls and campaign contacts
- `PATCH /api/leads/[id]` — update lead
- `DELETE /api/leads/[id]` — soft delete (set status to LOST)

**Step 2: Build leads list page**

- Table view with columns: Business Name, Contact, Phone, Debt Est, Score, Status, Source, Assigned To, Last Contact
- Score displayed as color-coded badge (red < 50, yellow 50-75, green > 75)
- Filter bar: status dropdown, source dropdown, search input
- Click row → lead detail page
- "Add Lead" button → new lead form
- Pipeline view toggle (Kanban-style board by status)

**Step 3: Build lead detail page**

- Header: business name, status badge, score, assigned rep
- Tabs: Overview, Calls, Activity
- Overview: all lead fields, edit inline
- Calls: list of calls with this lead, play recordings
- Quick actions: Call Now (launches dialer), Schedule Follow-up, Change Status

**Step 4: Build pipeline view**

Kanban board with columns: New → Contacted → Qualified → Callback → Enrolled
Drag and drop to change status.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add lead management with list, detail, pipeline views"
```

---

## Task 5: Mock Telephony Layer

**Files:**
- Create: `src/lib/telephony/types.ts` — telephony interface
- Create: `src/lib/telephony/mock-provider.ts` — mock implementation
- Create: `src/lib/telephony/index.ts` — provider factory

**Step 1: Define telephony interface**

```typescript
// src/lib/telephony/types.ts
export interface TelephonyProvider {
  makeCall(params: { to: string; from: string; agentId: string }): Promise<CallSession>
  endCall(callSid: string): Promise<void>
  holdCall(callSid: string): Promise<void>
  resumeCall(callSid: string): Promise<void>
  muteCall(callSid: string): Promise<void>
  unmuteCall(callSid: string): Promise<void>
  getCallStatus(callSid: string): Promise<CallStatus>
}

export interface CallSession {
  sid: string
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy'
  duration: number
  to: string
  from: string
}
```

**Step 2: Implement mock provider**

Mock provider that:
- Simulates call progression: initiated → ringing (1-3s) → answered/no-answer/voicemail (random)
- ~60% answer rate, ~20% no-answer, ~10% voicemail, ~10% busy
- Simulated call duration: 30-300 seconds for answered calls
- Emits status events via callback
- Generates fake recording URLs

**Step 3: Create provider factory**

```typescript
export function getTelephonyProvider(): TelephonyProvider {
  if (process.env.TELEPHONY_PROVIDER === 'twilio') {
    // Future: return new TwilioProvider()
    throw new Error('Twilio provider not yet implemented')
  }
  return new MockTelephonyProvider()
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add mock telephony provider layer"
```

---

## Task 6: Power Dialer Engine

**Files:**
- Create: `src/lib/dialer/dialer-engine.ts` — core dialer logic
- Create: `src/lib/dialer/types.ts`
- Create: `src/app/api/dialer/start/route.ts` — start dialing a campaign
- Create: `src/app/api/dialer/next/route.ts` — get next contact
- Create: `src/app/api/dialer/call/route.ts` — initiate call
- Create: `src/app/api/dialer/disposition/route.ts` — submit call disposition
- Create: `src/app/api/dialer/stop/route.ts` — stop dialing

**Step 1: Build dialer engine**

Power dialer logic:
1. Agent starts a campaign session
2. Engine pulls next contact (by priority, skip completed/max-attempts)
3. Agent sees lead info (preview)
4. Auto-dials (or agent clicks dial in preview mode)
5. Call connects → agent talks → call ends
6. Agent submits disposition
7. Engine queues next contact → repeat

**Step 2: Build API routes**

- `POST /api/dialer/start` — { campaignId, agentId } → starts session, returns first contact
- `POST /api/dialer/next` — { campaignId, agentId } → returns next contact to dial
- `POST /api/dialer/call` — { contactId, agentId } → initiates call via telephony provider
- `POST /api/dialer/disposition` — { callId, disposition, notes } → saves result, updates contact status
- `POST /api/dialer/stop` — { campaignId, agentId } → ends dialer session

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add power dialer engine and API routes"
```

---

## Task 7: Dialer UI

**Files:**
- Create: `src/app/(dashboard)/dialer/page.tsx`
- Create: `src/components/dialer/dialer-panel.tsx` — main dialer interface
- Create: `src/components/dialer/call-controls.tsx` — hold, mute, end, transfer buttons
- Create: `src/components/dialer/contact-preview.tsx` — shows lead info before/during call
- Create: `src/components/dialer/disposition-form.tsx` — post-call disposition
- Create: `src/components/dialer/call-timer.tsx` — live call timer
- Create: `src/components/dialer/campaign-selector.tsx`
- Create: `src/components/dialer/call-script.tsx` — displays campaign script with variable substitution
- Create: `src/components/dialer/dialer-stats.tsx` — session stats

**Step 1: Build dialer page layout**

Three-column layout:
- Left: Lead info card (contact preview) + call history with this lead
- Center: Call controls + timer + disposition form + call script
- Right: Live transcript (placeholder for Task 8) + AI coaching tips (placeholder)

**Step 2: Build call controls**

- Big green "Dial" button (or auto-dials in power mode)
- Call timer (counts up during active call)
- Hold / Resume button
- Mute / Unmute button
- End Call button (red)
- Status indicator: Ready → Dialing → Ringing → Connected → Wrap-up

**Step 3: Build disposition form**

After call ends, show disposition form:
- Disposition dropdown (Interested, Not Interested, Callback, etc.)
- Notes textarea
- Schedule callback date/time (if disposition = Callback)
- "Submit & Next" button — saves and auto-loads next contact

**Step 4: Build call script panel**

- Displays campaign script
- Variables auto-replaced: {agent_name}, {business_name}, {debt_estimate}, {industry}
- Collapsible sections for objection handling

**Step 5: Build session stats bar**

- Calls made this session
- Connected / No Answer / Voicemail / Busy counts
- Talk time total
- Enrollments this session

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add dialer UI with call controls, scripts, and dispositions"
```

---

## Task 8: AI Call Intelligence (Mock)

**Files:**
- Create: `src/lib/ai/types.ts` — AI service interfaces
- Create: `src/lib/ai/mock-transcription.ts` — mock real-time transcription
- Create: `src/lib/ai/mock-coaching.ts` — mock sales coaching tips
- Create: `src/lib/ai/mock-feedback.ts` — mock post-call feedback
- Create: `src/lib/ai/index.ts` — AI service factory
- Create: `src/components/dialer/live-transcript.tsx`
- Create: `src/components/dialer/coaching-tips.tsx`
- Create: `src/components/calls/call-feedback-card.tsx`
- Create: `src/app/api/calls/[id]/feedback/route.ts`
- Create: `src/app/api/calls/[id]/transcript/route.ts`

**Step 1: Define AI interfaces**

```typescript
export interface TranscriptionService {
  startTranscription(callId: string): void
  stopTranscription(callId: string): void
  onTranscriptUpdate(callback: (entry: TranscriptEntry) => void): void
}

export interface CoachingService {
  analyzeTranscript(entries: TranscriptEntry[]): CoachingTip[]
}

export interface FeedbackService {
  generateFeedback(callId: string, transcript: TranscriptEntry[]): Promise<CallFeedbackData>
}
```

**Step 2: Build mock transcription**

Simulates real-time transcript by:
- Emitting pre-scripted conversation lines at realistic intervals
- Alternating between "Agent" and "Lead" speakers
- Includes realistic debt settlement conversations
- 5-6 different conversation scenarios that rotate

**Step 3: Build mock coaching**

During a "call", analyzes the mock transcript and surfaces tips:
- Detects keywords: "expensive", "not sure", "competitor" → surfaces relevant tip
- Suggests next talking points based on conversation stage
- Alerts on buying signals: "tell me more", "how does it work", "what's the process"

**Step 4: Build mock post-call feedback**

After call ends, generates:
- Overall score (0-100)
- Talk ratio analysis
- Objection handling score
- Key moments identified
- Strengths and improvement suggestions
- Auto-generated call summary

**Step 5: Build live transcript component**

- Shows transcript entries scrolling in real-time during call
- Agent lines in blue, Lead lines in gray
- Auto-scrolls to bottom
- Timestamps on each entry

**Step 6: Build coaching tips component**

- Card that appears in dialer sidebar during calls
- Tips appear/disappear based on conversation
- Color coded: green (buying signal), yellow (objection), blue (suggestion)
- Dismissable

**Step 7: Build post-call feedback card**

- Shown on call detail page
- Score with circular progress indicator
- Strengths as green badges, improvements as yellow badges
- Key moments timeline
- Call summary text

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add AI call intelligence with mock transcription, coaching, and feedback"
```

---

## Task 9: Campaign Management

**Files:**
- Create: `src/app/(dashboard)/campaigns/page.tsx` — campaign list
- Create: `src/app/(dashboard)/campaigns/[id]/page.tsx` — campaign detail
- Create: `src/app/(dashboard)/campaigns/new/page.tsx` — create campaign
- Create: `src/app/api/campaigns/route.ts`
- Create: `src/app/api/campaigns/[id]/route.ts`
- Create: `src/app/api/campaigns/[id]/contacts/route.ts`
- Create: `src/components/campaigns/campaign-form.tsx`
- Create: `src/components/campaigns/campaign-stats.tsx`
- Create: `src/components/campaigns/contact-list-manager.tsx`

**Step 1: Build campaign API routes**

- CRUD for campaigns
- Add/remove contacts from campaigns
- Assign agents to campaigns
- Campaign stats endpoint (total contacts, called, connected, enrolled)

**Step 2: Build campaign list page**

Table showing: Name, Status, Dialer Mode, Contacts, Called, Connected %, Enrolled

**Step 3: Build create/edit campaign page**

Form with:
- Name, description
- Dialer mode selector (Power, Preview, Manual)
- Call script editor (rich text)
- Calling hours (start/end time + timezone)
- Add leads (search and select, or filter and bulk add)
- Assign agents

**Step 4: Build campaign detail page**

- Stats cards: Total Contacts, Dialed, Connected, Enrolled, Remaining
- Contact list with status indicators
- Agent performance within this campaign
- "Launch Dialer" button → goes to dialer page with this campaign loaded

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add campaign management with create, detail, and contact management"
```

---

## Task 10: Call History & Dashboard

**Files:**
- Create: `src/app/(dashboard)/calls/page.tsx` — call log
- Create: `src/app/(dashboard)/calls/[id]/page.tsx` — call detail
- Create: `src/app/(dashboard)/dashboard/page.tsx` — main dashboard
- Create: `src/app/api/calls/route.ts`
- Create: `src/app/api/dashboard/stats/route.ts`
- Create: `src/components/calls/call-log-table.tsx`
- Create: `src/components/calls/call-detail.tsx`
- Create: `src/components/dashboard/stats-cards.tsx`
- Create: `src/components/dashboard/recent-calls.tsx`
- Create: `src/components/dashboard/lead-pipeline-chart.tsx`
- Create: `src/components/dashboard/agent-leaderboard.tsx`

**Step 1: Build call log page**

- Table: Date, Lead, Agent, Direction, Duration, Disposition, Score
- Filters: date range, agent, disposition, campaign
- Click row → call detail

**Step 2: Build call detail page**

- Call info: lead, agent, duration, disposition
- Full transcript
- AI feedback card
- Recording player (mock audio placeholder)
- Notes

**Step 3: Build main dashboard**

Stats cards:
- Calls Today / This Week / This Month
- Enrollments This Month
- Avg Call Duration
- Connection Rate

Charts:
- Lead pipeline distribution (bar chart)
- Calls over time (line chart — use simple CSS bars, no chart library needed)

Tables:
- Recent calls (last 10)
- Agent leaderboard (calls, connections, enrollments, avg score)

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add call history, call detail, and main dashboard"
```

---

## Task 11: AI Workflow Agents (Foundation)

**Files:**
- Create: `src/lib/ai/agents/lead-scoring.ts`
- Create: `src/lib/ai/agents/call-follow-up.ts`
- Create: `src/app/api/ai/score-lead/route.ts`
- Create: `src/app/api/ai/call-followup/route.ts`
- Modify: `src/components/leads/lead-score-badge.tsx` — add "Re-score" button

**Step 1: Build lead scoring agent**

Mock AI that scores leads 0-100 based on:
- Total debt estimate (higher = better, up to a point)
- Annual revenue (ability to pay program fees)
- Lead source (referrals score highest)
- Industry (some industries settle better)
- Number of contact attempts
- Returns score + reasoning text

**Step 2: Build call follow-up agent**

After a call with a transcript, generates:
- Auto-filled call notes from transcript
- Suggested follow-up action (call back, send info, enroll, mark DNC)
- Draft follow-up SMS/email text
- Creates next follow-up date

**Step 3: Wire into UI**

- Lead score badge shows score with tooltip showing reason
- "Re-score" button triggers fresh AI scoring
- After call disposition, show AI-suggested follow-up as a prompt

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add AI workflow agents for lead scoring and call follow-up"
```

---

## Execution Order & Dependencies

```
Task 1 (Scaffold)
  └── Task 2 (Database)
       └── Task 3 (Auth & Layout)
            ├── Task 4 (Lead CRM)
            ├── Task 5 (Mock Telephony)  ──┐
            │                               ├── Task 6 (Dialer Engine)
            │                               │    └── Task 7 (Dialer UI)
            │                               │         └── Task 8 (AI Call Intelligence)
            ├── Task 9 (Campaigns)
            └── Task 10 (Dashboard)
                 └── Task 11 (AI Workflow Agents)
```

**Parallelizable after Task 3:**
- Task 4 (Lead CRM) + Task 5 (Mock Telephony) + Task 9 (Campaigns) can run in parallel
- Task 10 (Dashboard) can start once Task 4 APIs exist
- Task 8 (AI Intelligence) depends on Task 7 (Dialer UI)
- Task 11 (AI Agents) depends on Task 4 (Leads) and Task 8 (AI)
