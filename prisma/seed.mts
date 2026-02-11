import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { hash } from "bcryptjs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "dev.db");

const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create users
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@coastalcrm.com",
      passwordHash: await hash("password123", 12),
      role: "ADMIN",
    },
  });

  const salesRep = await prisma.user.create({
    data: {
      name: "John Sales",
      email: "john@coastalcrm.com",
      passwordHash: await hash("password123", 12),
      role: "SALES_REP",
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: "Sarah Manager",
      email: "sarah@coastalcrm.com",
      passwordHash: await hash("password123", 12),
      role: "MANAGER",
    },
  });

  const negotiator = await prisma.user.create({
    data: {
      name: "Mike Negotiator",
      email: "mike@coastalcrm.com",
      passwordHash: await hash("password123", 12),
      role: "NEGOTIATOR",
    },
  });

  // Create sample leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        businessName: "Acme Construction LLC",
        contactName: "Bob Johnson",
        phone: "+15551234567",
        email: "bob@acmeconstruction.com",
        ein: "12-3456789",
        industry: "Construction",
        annualRevenue: 850000,
        totalDebtEst: 125000,
        source: "WEBSITE",
        status: "NEW",
        score: 85,
        scoreReason: "High debt-to-revenue ratio, active business, responsive to outreach",
        assignedToId: salesRep.id,
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Sunrise Restaurant Group",
        contactName: "Maria Garcia",
        phone: "+15559876543",
        email: "maria@sunrisegroup.com",
        ein: "98-7654321",
        industry: "Food Service",
        annualRevenue: 420000,
        totalDebtEst: 78000,
        source: "REFERRAL",
        status: "CONTACTED",
        score: 72,
        scoreReason: "Moderate debt, seasonal business, showed interest in consultation",
        assignedToId: salesRep.id,
        lastContactedAt: new Date("2026-02-10"),
        nextFollowUpAt: new Date("2026-02-13"),
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Metro Auto Repair",
        contactName: "James Williams",
        phone: "+15555551234",
        email: "james@metroauto.com",
        industry: "Automotive",
        annualRevenue: 310000,
        totalDebtEst: 95000,
        source: "MAILER",
        status: "NEW",
        score: 68,
        scoreReason: "Good debt amount, stable industry, no prior contact",
        assignedToId: salesRep.id,
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Brightside Landscaping",
        contactName: "Tom Peters",
        phone: "+15553334444",
        email: "tom@brightsidelandscaping.com",
        industry: "Landscaping",
        annualRevenue: 190000,
        totalDebtEst: 42000,
        source: "COLD_CALL",
        status: "ENROLLED",
        score: 91,
        scoreReason: "Ready to enroll, has documentation ready, motivated",
        assignedToId: salesRep.id,
        lastContactedAt: new Date("2026-02-09"),
        nextFollowUpAt: new Date("2026-02-11"),
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Downtown Dental Practice",
        contactName: "Dr. Lisa Chen",
        phone: "+15556667777",
        email: "lisa@downtowndental.com",
        industry: "Healthcare",
        annualRevenue: 620000,
        totalDebtEst: 210000,
        source: "PURCHASED_LIST",
        status: "NEW",
        score: 78,
        scoreReason: "High debt amount, professional practice, good revenue",
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Pacific Plumbing Services",
        contactName: "Mike Thompson",
        phone: "+15558889999",
        email: "mike@pacificplumbing.com",
        industry: "Plumbing",
        annualRevenue: 275000,
        totalDebtEst: 88000,
        source: "WEBSITE",
        status: "CALLBACK",
        score: 65,
        scoreReason: "Interested but needs to discuss with partner",
        assignedToId: salesRep.id,
        lastContactedAt: new Date("2026-02-08"),
        nextFollowUpAt: new Date("2026-02-12"),
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Golden State Electric",
        contactName: "David Park",
        phone: "+15552223333",
        email: "david@gselectric.com",
        industry: "Electrical",
        annualRevenue: 510000,
        totalDebtEst: 155000,
        source: "REFERRAL",
        status: "ENROLLED",
        score: 82,
        scoreReason: "Referred by enrolled client, high debt, good revenue",
        assignedToId: salesRep.id,
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Bella Vista Catering",
        contactName: "Rosa Martinez",
        phone: "+15554445555",
        email: "rosa@bellavista.com",
        industry: "Food Service",
        annualRevenue: 180000,
        totalDebtEst: 62000,
        source: "SOCIAL",
        status: "CONTACTED",
        score: 58,
        scoreReason: "Lower revenue, may struggle with program payments",
        assignedToId: salesRep.id,
        lastContactedAt: new Date("2026-02-07"),
      },
    }),
  ]);

  // Create a campaign with contacts
  const campaign = await prisma.campaign.create({
    data: {
      name: "February New Lead Blitz",
      description: "Outreach to all new leads from January/February",
      dialerMode: "POWER",
      status: "ACTIVE",
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
      startTime: "09:00",
      endTime: "18:00",
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
  });

  // ============ CLIENTS (from enrolled leads) ============

  // leads[3] = Brightside Landscaping (ENROLLED)
  // leads[6] = Golden State Electric (ENROLLED)

  const client1 = await prisma.client.create({
    data: {
      leadId: leads[3].id,
      programStartDate: new Date("2026-01-15"),
      programLength: 24,
      monthlyPayment: 850,
      totalEnrolledDebt: 42000,
      totalSettled: 12500,
      totalFees: 1250,
      status: "ACTIVE",
      assignedNegotiatorId: negotiator.id,
    },
  });

  const client2 = await prisma.client.create({
    data: {
      leadId: leads[6].id,
      programStartDate: new Date("2026-02-01"),
      programLength: 36,
      monthlyPayment: 1500,
      totalEnrolledDebt: 155000,
      totalSettled: 0,
      totalFees: 0,
      status: "ACTIVE",
      assignedNegotiatorId: negotiator.id,
    },
  });

  // ============ DEBTS ============

  const debt1 = await prisma.debt.create({
    data: {
      clientId: client1.id,
      creditorName: "First National Bank",
      creditorPhone: "+18005551234",
      accountNumber: "FNB-78901",
      originalBalance: 18000,
      currentBalance: 16500,
      enrolledBalance: 18000,
      status: "SETTLED",
      settledAmount: 12500,
      settledDate: new Date("2026-02-05"),
      savingsAmount: 5500,
      savingsPercent: 30.6,
    },
  });

  const debt2 = await prisma.debt.create({
    data: {
      clientId: client1.id,
      creditorName: "Capital Equipment Leasing",
      creditorPhone: "+18005559876",
      creditorEmail: "collections@capequip.com",
      accountNumber: "CEL-34567",
      originalBalance: 24000,
      currentBalance: 23200,
      enrolledBalance: 24000,
      status: "NEGOTIATING",
    },
  });

  const debt3 = await prisma.debt.create({
    data: {
      clientId: client2.id,
      creditorName: "Business Credit Solutions",
      creditorPhone: "+18005554321",
      accountNumber: "BCS-11223",
      originalBalance: 85000,
      currentBalance: 82000,
      enrolledBalance: 85000,
      status: "NEGOTIATING",
    },
  });

  const debt4 = await prisma.debt.create({
    data: {
      clientId: client2.id,
      creditorName: "Metro Commercial Lending",
      creditorEmail: "recovery@metrolend.com",
      accountNumber: "MCL-99887",
      originalBalance: 70000,
      currentBalance: 70000,
      enrolledBalance: 70000,
      status: "ENROLLED",
    },
  });

  // ============ NEGOTIATIONS ============

  await prisma.negotiation.create({
    data: {
      debtId: debt1.id,
      negotiatorId: negotiator.id,
      type: "CALL",
      date: new Date("2026-01-25"),
      offerAmount: 10000,
      offerPercent: 55.6,
      response: "REJECTED",
      notes: "Creditor rejected initial offer, wants at least 70%",
    },
  });

  await prisma.negotiation.create({
    data: {
      debtId: debt1.id,
      negotiatorId: negotiator.id,
      type: "CALL",
      date: new Date("2026-02-02"),
      offerAmount: 12500,
      offerPercent: 69.4,
      response: "ACCEPTED",
      notes: "Creditor accepted lump sum settlement at 69.4%",
    },
  });

  await prisma.negotiation.create({
    data: {
      debtId: debt2.id,
      negotiatorId: negotiator.id,
      type: "EMAIL",
      date: new Date("2026-02-08"),
      offerAmount: 14000,
      offerPercent: 58.3,
      response: "COUNTERED",
      counterAmount: 18000,
      notes: "Creditor countered with 75%, willing to negotiate further",
    },
  });

  await prisma.negotiation.create({
    data: {
      debtId: debt3.id,
      negotiatorId: negotiator.id,
      type: "LETTER",
      date: new Date("2026-02-10"),
      offerAmount: 45000,
      offerPercent: 52.9,
      response: "PENDING",
      notes: "Sent initial settlement proposal via certified mail",
    },
  });

  // ============ PAYMENTS ============

  // Client 1 program payments (started Jan 15, monthly $850)
  await prisma.payment.create({
    data: {
      clientId: client1.id,
      type: "CLIENT_PAYMENT",
      amount: 850,
      scheduledDate: new Date("2026-01-15"),
      paidDate: new Date("2026-01-15"),
      status: "COMPLETED",
      reference: "PAY-001",
    },
  });

  await prisma.payment.create({
    data: {
      clientId: client1.id,
      type: "CLIENT_PAYMENT",
      amount: 850,
      scheduledDate: new Date("2026-02-15"),
      status: "SCHEDULED",
    },
  });

  // Settlement payout for debt1
  await prisma.payment.create({
    data: {
      clientId: client1.id,
      debtId: debt1.id,
      type: "SETTLEMENT_PAYOUT",
      amount: 12500,
      scheduledDate: new Date("2026-02-06"),
      paidDate: new Date("2026-02-06"),
      status: "COMPLETED",
      reference: "SET-001",
      notes: "Settlement payout to First National Bank",
    },
  });

  // Client 2 program payments (started Feb 1, monthly $1500)
  await prisma.payment.create({
    data: {
      clientId: client2.id,
      type: "CLIENT_PAYMENT",
      amount: 1500,
      scheduledDate: new Date("2026-02-01"),
      paidDate: new Date("2026-02-01"),
      status: "COMPLETED",
      reference: "PAY-002",
    },
  });

  await prisma.payment.create({
    data: {
      clientId: client2.id,
      type: "CLIENT_PAYMENT",
      amount: 1500,
      scheduledDate: new Date("2026-03-01"),
      status: "SCHEDULED",
    },
  });

  await prisma.payment.create({
    data: {
      clientId: client2.id,
      type: "CLIENT_PAYMENT",
      amount: 1500,
      scheduledDate: new Date("2026-04-01"),
      status: "SCHEDULED",
    },
  });

  console.log("Seed complete!");
  console.log(`  Users: 4 (admin, sales rep, manager, negotiator)`);
  console.log(`  Leads: ${leads.length}`);
  console.log(`  Campaign: ${campaign.name}`);
  console.log(`  Clients: 2`);
  console.log(`  Debts: 4`);
  console.log(`  Negotiations: 4`);
  console.log(`  Payments: 6`);
  console.log(`\n  Login: john@coastalcrm.com / password123`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
