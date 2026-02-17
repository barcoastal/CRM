import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

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

  await prisma.user.create({
    data: {
      name: "Sarah Manager",
      email: "sarah@coastalcrm.com",
      passwordHash: await hash("password123", 12),
      role: "MANAGER",
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
        status: "QUALIFIED",
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
        status: "NEW",
        score: 82,
        scoreReason: "Referred by enrolled client, high debt, good revenue",
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

  console.log("Seed complete!");
  console.log(`  Users: 3 (admin, sales rep, manager)`);
  console.log(`  Leads: ${leads.length}`);
  console.log(`  Campaign: ${campaign.name}`);
  console.log(`\n  Login: john@coastalcrm.com / password123`);

  await prisma.$disconnect();
}

main().catch(console.error);
