import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// ---------- ROLES (mirrors SF UserRole hierarchy) ----------
const ROLES: { developerName: string; name: string; parent?: string }[] = [
  { developerName: "CEO", name: "CEO" },
  { developerName: "VPofSales", name: "VP of Sales", parent: "CEO" },
  { developerName: "SalesManager", name: "Sales Manager", parent: "VPofSales" },
  { developerName: "SalesAdmins", name: "Sales Admins", parent: "VPofSales" },
  { developerName: "Closer", name: "Closer", parent: "SalesManager" },
  { developerName: "CMO", name: "CMO", parent: "CEO" },
  { developerName: "Marketing", name: "Marketing", parent: "CMO" },
  { developerName: "CustomerServicesManager", name: "Customer Services Manager", parent: "CEO" },
  { developerName: "CustomerServicesRep", name: "Customer Services Rep", parent: "CustomerServicesManager" },
  { developerName: "CustomerSurveyRep", name: "Customer Survey Rep", parent: "CustomerServicesManager" },
  { developerName: "DebtNegotiation", name: "Debt Negotiation", parent: "CEO" },
  { developerName: "ExternalDebtNegotiator", name: "External Debt Negotiator", parent: "DebtNegotiation" },
  { developerName: "Affiliates", name: "Affiliates", parent: "CEO" },
  { developerName: "Admin", name: "Admin", parent: "CEO" },
  { developerName: "ITSupport", name: "IT Support", parent: "Admin" },
  { developerName: "Backoffice", name: "Backoffice", parent: "CEO" },
];

// ---------- PERMISSION SETS + the keys they grant (subset of SF 94 ps) ----------
const PERM_SETS: { name: string; label: string; description: string; keys: string[] }[] = [
  {
    name: "Lead_Basic",
    label: "Lead — Basic",
    description: "View / create / edit leads",
    keys: ["Lead.View", "Lead.Create", "Lead.Edit"],
  },
  {
    name: "Lead_Full",
    label: "Lead — Full",
    description: "All lead actions including conversion, import, mass reassign",
    keys: ["Lead.View", "Lead.Create", "Lead.Edit", "Lead.Delete", "Lead.Convert", "Lead.Import", "Lead.MassReassign", "Lead.ViewAll"],
  },
  {
    name: "Lead_BypassValidation",
    label: "Lead — Bypass Validation",
    description: "Bypass lead-level validation rules (use sparingly)",
    keys: ["Bypass.LeadValidation"],
  },
  {
    name: "Opportunity_Basic",
    label: "Opportunity — Basic",
    description: "View / create / edit opps you own",
    keys: ["Opportunity.View", "Opportunity.Create", "Opportunity.Edit"],
  },
  {
    name: "Opportunity_Full",
    label: "Opportunity — Full",
    description: "All opp actions including modify all",
    keys: ["Opportunity.View", "Opportunity.Create", "Opportunity.Edit", "Opportunity.Delete", "Opportunity.ViewAll", "Opportunity.ModifyAll", "Opportunity.EditLocked"],
  },
  {
    name: "Account_Basic",
    label: "Account — Basic",
    description: "View / create / edit accounts",
    keys: ["Account.View", "Account.Create", "Account.Edit", "Contact.View", "Contact.Create", "Contact.Edit"],
  },
  {
    name: "Account_Full",
    label: "Account — Full",
    description: "All account + contact actions",
    keys: ["Account.View", "Account.Create", "Account.Edit", "Account.Delete", "Account.ViewAll", "Account.ModifyAll", "Contact.View", "Contact.Create", "Contact.Edit", "Contact.Delete"],
  },
  {
    name: "Debt_Operations",
    label: "Debt Operations",
    description: "Manage debts, offers, settlements, fees",
    keys: ["Debt.View", "Debt.Create", "Debt.Edit", "Debt.Delete", "Offer.View", "Offer.Create", "Offer.Edit", "Settlement.View", "Settlement.Create", "Settlement.Edit", "Fee.View", "Fee.Charge"],
  },
  {
    name: "Settlement_Approve",
    label: "Settlement Approval",
    description: "Approve settlements (typically Debt Negotiation Manager)",
    keys: ["Settlement.Approve", "Fee.Waive"],
  },
  {
    name: "ProgramPlan_Manage",
    label: "Program Plan Management",
    description: "Create and change client program plans",
    keys: ["ProgramPlan.View", "ProgramPlan.Create", "ProgramPlan.Edit", "ProgramPlan.Change"],
  },
  {
    name: "Payments_Operations",
    label: "Payments Operations",
    description: "View and process payments, retry drafts",
    keys: ["Payment.View", "Payment.Process", "Draft.View", "Draft.Retry", "Draft.Cancel"],
  },
  {
    name: "Payments_Refund",
    label: "Payments — Refund",
    description: "Issue refunds (typically Back Office Manager)",
    keys: ["Payment.Refund"],
  },
  {
    name: "Case_Basic",
    label: "Case — Basic",
    description: "View, create, edit, close cases",
    keys: ["Case.View", "Case.Create", "Case.Edit", "Case.Close"],
  },
  {
    name: "Case_Escalate",
    label: "Case Escalation",
    description: "Escalate cases to higher tier queues",
    keys: ["Case.Escalate"],
  },
  {
    name: "Case_Approve",
    label: "Case Approval",
    description: "Approve cases needing supervisor sign-off",
    keys: ["Case.Approve"],
  },
  {
    name: "Activity_Basic",
    label: "Activities — Basic",
    description: "Tasks, events, calls",
    keys: ["Task.View", "Task.Create", "Task.Edit", "Event.View", "Event.Create", "Event.Edit", "Call.View", "Call.Log"],
  },
  {
    name: "Call_ListenRecording",
    label: "Listen to Call Recordings",
    description: "Access call recording playback",
    keys: ["Call.ListenRecording"],
  },
  {
    name: "Email_Send",
    label: "Send Email",
    description: "Send single emails",
    keys: ["Email.Send"],
  },
  {
    name: "Email_MassSend",
    label: "Mass Email",
    description: "Send mass/list emails (marketing)",
    keys: ["Email.MassSend", "Email.Send"],
  },
  {
    name: "SMS_Send",
    label: "Send SMS",
    description: "Send outbound SMS",
    keys: ["SMS.Send"],
  },
  {
    name: "Reports_Basic",
    label: "Reports — Basic",
    description: "View reports and dashboards",
    keys: ["Reports.View", "Dashboards.View"],
  },
  {
    name: "Reports_Full",
    label: "Reports — Full",
    description: "Create, edit, and export reports",
    keys: ["Reports.View", "Reports.Create", "Reports.Edit", "Reports.Export", "Dashboards.View", "Dashboards.Create"],
  },
  {
    name: "Reports_Export",
    label: "Reports — Export",
    description: "Export reports to CSV/XLS",
    keys: ["Reports.Export"],
  },
  {
    name: "User_Management",
    label: "User Management",
    description: "Manage users, profiles, perm sets, roles, queues",
    keys: ["User.View", "User.Create", "User.Edit", "User.Deactivate", "Permission.Manage", "Role.Manage", "Queue.Manage"],
  },
  {
    name: "Audit_View",
    label: "View Audit Logs",
    description: "Access audit and application logs",
    keys: ["Audit.View", "AppLog.View", "AsyncOp.View"],
  },
  {
    name: "Integration_Admin",
    label: "Integration Admin",
    description: "Manage external integrations (Five9, Telnyx, DocuSign, etc.)",
    keys: ["Integration.Manage"],
  },
  {
    name: "Modify_All_Data",
    label: "Modify All Data",
    description: "Override all object-level permissions (System Admin)",
    keys: ["Modify.AllData"],
  },
];

// ---------- PERMISSION SET GROUPS ----------
const PSGS: { name: string; label: string; description: string; sets: string[] }[] = [
  {
    name: "Closer_PSG",
    label: "Closers PSG",
    description: "Bundle for Closer profile",
    sets: ["Lead_Basic", "Opportunity_Basic", "Account_Basic", "Activity_Basic", "Email_Send", "SMS_Send", "Reports_Basic", "Call_ListenRecording"],
  },
  {
    name: "Opener_PSG",
    label: "Openers PSG",
    description: "Bundle for Opener profile",
    sets: ["Lead_Basic", "Activity_Basic", "Email_Send", "SMS_Send", "Reports_Basic"],
  },
  {
    name: "DebtNegotiator_PSG",
    label: "Debt Negotiators PSG",
    description: "Bundle for Debt Negotiator profile",
    sets: ["Debt_Operations", "Account_Basic", "Activity_Basic", "Email_Send", "Reports_Basic"],
  },
  {
    name: "CSA_PSG",
    label: "Customer Services Reps PSG",
    description: "Bundle for CSA profile",
    sets: ["Case_Basic", "Account_Basic", "Activity_Basic", "Payments_Operations", "Email_Send", "SMS_Send", "Reports_Basic"],
  },
  {
    name: "Admin_PSG",
    label: "Admins PSG",
    description: "Bundle for Admin profile",
    sets: ["Modify_All_Data", "User_Management", "Audit_View", "Integration_Admin", "Reports_Full"],
  },
];

// ---------- PROFILES (condensed from 60 SF profiles to the business-relevant set) ----------
const PROFILES: { name: string; label: string; description: string; userType: string; psgs: string[]; extraSets?: string[] }[] = [
  { name: "System_Administrator", label: "System Administrator", description: "Full access", userType: "Standard", psgs: ["Admin_PSG"] },
  { name: "Admin", label: "Admin", description: "Operational admin", userType: "Standard", psgs: ["Admin_PSG"] },
  { name: "IT_Support", label: "IT Support", description: "IT helpdesk", userType: "Standard", psgs: [], extraSets: ["User_Management", "Audit_View", "Integration_Admin"] },
  { name: "Opener", label: "Opener", description: "Initial dial / qualification", userType: "Standard", psgs: ["Opener_PSG"] },
  { name: "Closer", label: "Closer", description: "Close the deal", userType: "Standard", psgs: ["Closer_PSG"] },
  { name: "Closer_DS", label: "Closer (DS)", description: "Closer specialized in Debt Settlement", userType: "Standard", psgs: ["Closer_PSG"] },
  { name: "Manager", label: "Manager", description: "Floor manager", userType: "Standard", psgs: ["Closer_PSG"], extraSets: ["Opportunity_Full", "Lead_Full", "Reports_Full"] },
  { name: "Supervisor", label: "Supervisor", description: "Team supervisor", userType: "Standard", psgs: ["Closer_PSG"], extraSets: ["Reports_Full"] },
  { name: "Customer_Services_Rep", label: "Customer Services Rep", description: "Post-enrollment client support", userType: "Standard", psgs: ["CSA_PSG"] },
  { name: "Customer_Services_Manager", label: "Customer Services Manager", description: "CSA supervisor", userType: "Standard", psgs: ["CSA_PSG"], extraSets: ["Case_Escalate", "Case_Approve", "Reports_Full", "Payments_Refund"] },
  { name: "Debt_Negotiator", label: "Debt Negotiator", description: "Negotiates with creditors", userType: "Standard", psgs: ["DebtNegotiator_PSG"] },
  { name: "Debt_Negotiation_Manager", label: "Debt Negotiation Manager", description: "Approves settlements", userType: "Standard", psgs: ["DebtNegotiator_PSG"], extraSets: ["Settlement_Approve", "Reports_Full"] },
  { name: "Back_Office", label: "Back Office", description: "Payments / drafts ops", userType: "Standard", psgs: [], extraSets: ["Payments_Operations", "Account_Basic", "Activity_Basic", "Reports_Basic"] },
  { name: "Marketing", label: "Marketing", description: "Marketing team", userType: "Standard", psgs: [], extraSets: ["Lead_Full", "Email_MassSend", "Reports_Full", "Account_Basic"] },
  { name: "Affiliate", label: "Affiliate / Lead Source Partner", description: "External lead vendor", userType: "Standard", psgs: [], extraSets: ["Lead_Basic"] },
];

// ---------- QUEUES (mirror SF queues exactly) ----------
const QUEUES: { developerName: string; name: string; supportedEntities: string }[] = [
  { developerName: "Closer_Pool", name: "Closer Pool", supportedEntities: "Lead,Opportunity" },
  { developerName: "CS_Case_Approvers", name: "CS Case Approvers", supportedEntities: "Case" },
  { developerName: "CS_L1", name: "CS L1", supportedEntities: "Case" },
  { developerName: "CS_L2", name: "CS L2", supportedEntities: "Case" },
  { developerName: "Five9", name: "Five9", supportedEntities: "Lead,Call" },
  { developerName: "IT_Support", name: "IT Support", supportedEntities: "Case" },
  { developerName: "L1", name: "L1", supportedEntities: "Case,Task" },
  { developerName: "L2", name: "L2", supportedEntities: "Case,Task" },
  { developerName: "L3", name: "L3", supportedEntities: "Case,Task" },
  { developerName: "Salesforce", name: "Salesforce", supportedEntities: "Lead,Case,Task" },
];

async function nukeAccessControl() {
  // Order matters for FKs
  await prisma.userPermissionSet.deleteMany();
  await prisma.profilePermission.deleteMany();
  await prisma.permissionSetGroupItem.deleteMany();
  await prisma.permissionSetPermission.deleteMany();
  await prisma.permissionSetGroup.deleteMany();
  await prisma.permissionSet.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.role.deleteMany();
}

async function nukeBusinessData() {
  await prisma.callFeedback.deleteMany();
  await prisma.transcript.deleteMany();
  await prisma.call.deleteMany();
  await prisma.campaignContact.deleteMany();
  await prisma.campaignAgent.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.negotiation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.client.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();
}

async function nukeInfra() {
  await prisma.auditLog.deleteMany();
  await prisma.applicationLog.deleteMany();
  await prisma.asyncOperation.deleteMany();
}

async function seedRoles() {
  const rolesByDev = new Map<string, string>(); // devName → id
  // First pass: create without parents
  for (const r of ROLES) {
    const created = await prisma.role.create({ data: { name: r.name, developerName: r.developerName } });
    rolesByDev.set(r.developerName, created.id);
  }
  // Second pass: wire parents
  for (const r of ROLES) {
    if (!r.parent) continue;
    await prisma.role.update({
      where: { id: rolesByDev.get(r.developerName)! },
      data: { parentId: rolesByDev.get(r.parent)! },
    });
  }
  return rolesByDev;
}

async function seedPermSets() {
  const psByName = new Map<string, string>(); // name → id
  for (const ps of PERM_SETS) {
    const created = await prisma.permissionSet.create({
      data: {
        name: ps.name,
        label: ps.label,
        description: ps.description,
        isCustom: true,
        permissions: { create: ps.keys.map((key) => ({ key })) },
      },
    });
    psByName.set(ps.name, created.id);
  }
  return psByName;
}

async function seedPSGs(psByName: Map<string, string>) {
  const psgByName = new Map<string, string>();
  for (const psg of PSGS) {
    const created = await prisma.permissionSetGroup.create({
      data: {
        name: psg.name,
        label: psg.label,
        description: psg.description,
        items: { create: psg.sets.map((setName) => ({ permissionSetId: psByName.get(setName)! })) },
      },
    });
    psgByName.set(psg.name, created.id);
  }
  return psgByName;
}

async function seedProfiles(psByName: Map<string, string>, psgByName: Map<string, string>) {
  const profilesByName = new Map<string, string>();
  for (const p of PROFILES) {
    // Resolve PSG → individual perm sets via the items
    const setsFromPSGs: string[] = [];
    for (const psgName of p.psgs) {
      const psg = await prisma.permissionSetGroup.findUnique({
        where: { name: psgName },
        include: { items: true },
      });
      if (psg) for (const item of psg.items) setsFromPSGs.push(item.permissionSetId);
    }
    const extra = (p.extraSets ?? []).map((n) => psByName.get(n)).filter((x): x is string => Boolean(x));
    const uniqueSetIds = Array.from(new Set([...setsFromPSGs, ...extra]));
    const created = await prisma.profile.create({
      data: {
        name: p.name,
        label: p.label,
        description: p.description,
        userType: p.userType,
        permissions: { create: uniqueSetIds.map((permissionSetId) => ({ permissionSetId })) },
      },
    });
    profilesByName.set(p.name, created.id);
  }
  return profilesByName;
}

async function seedQueues() {
  const queuesByDev = new Map<string, string>();
  for (const q of QUEUES) {
    const created = await prisma.group.create({
      data: {
        developerName: q.developerName,
        name: q.name,
        type: "QUEUE",
        supportedEntities: q.supportedEntities,
      },
    });
    queuesByDev.set(q.developerName, created.id);
  }
  return queuesByDev;
}

async function main() {
  console.log("Wiping data...");
  await nukeBusinessData();
  await nukeAccessControl();
  await nukeInfra();

  console.log("Seeding access control...");
  const rolesByDev = await seedRoles();
  const psByName = await seedPermSets();
  const psgByName = await seedPSGs(psByName);
  const profilesByName = await seedProfiles(psByName, psgByName);
  const queuesByDev = await seedQueues();

  console.log("Seeding users...");
  const passwordHash = await hash("password123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Bar Elezra",
      email: "bar@coastaldebt.com",
      passwordHash,
      role: "ADMIN",
      profileId: profilesByName.get("System_Administrator")!,
      hierarchyRoleId: rolesByDev.get("CEO")!,
    },
  });

  const salesMgr = await prisma.user.create({
    data: {
      name: "Sarah Manager",
      email: "sarah@coastaldebt.com",
      passwordHash,
      role: "MANAGER",
      profileId: profilesByName.get("Manager")!,
      hierarchyRoleId: rolesByDev.get("SalesManager")!,
      managerId: admin.id,
    },
  });

  const closer = await prisma.user.create({
    data: {
      name: "John Closer",
      email: "john@coastaldebt.com",
      passwordHash,
      role: "SALES_REP",
      profileId: profilesByName.get("Closer")!,
      hierarchyRoleId: rolesByDev.get("Closer")!,
      managerId: salesMgr.id,
    },
  });

  const csa = await prisma.user.create({
    data: {
      name: "Lisa Support",
      email: "lisa@coastaldebt.com",
      passwordHash,
      role: "CS_REP",
      profileId: profilesByName.get("Customer_Services_Rep")!,
      hierarchyRoleId: rolesByDev.get("CustomerServicesRep")!,
    },
  });

  const negotiator = await prisma.user.create({
    data: {
      name: "Mike Negotiator",
      email: "mike@coastaldebt.com",
      passwordHash,
      role: "NEGOTIATOR",
      profileId: profilesByName.get("Debt_Negotiator")!,
      hierarchyRoleId: rolesByDev.get("DebtNegotiation")!,
    },
  });

  // Queue memberships
  await prisma.groupMember.createMany({
    data: [
      { groupId: queuesByDev.get("Closer_Pool")!, userId: closer.id },
      { groupId: queuesByDev.get("CS_L1")!, userId: csa.id },
      { groupId: queuesByDev.get("L1")!, userId: csa.id },
    ],
  });

  // ---------- SAMPLE BUSINESS DATA (so existing UI still works) ----------
  console.log("Seeding sample leads + campaign...");
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        businessName: "Acme Construction LLC", contactName: "Bob Johnson",
        phone: "+15551234567", email: "bob@acmeconstruction.com",
        ein: "12-3456789", industry: "Construction",
        annualRevenue: 850000, totalDebtEst: 125000,
        source: "WEBSITE", status: "NEW", score: 85,
        scoreReason: "High debt-to-revenue ratio, active business, responsive",
        assignedToId: closer.id,
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Sunrise Restaurant Group", contactName: "Maria Garcia",
        phone: "+15559876543", email: "maria@sunrisegroup.com",
        ein: "98-7654321", industry: "Food Service",
        annualRevenue: 420000, totalDebtEst: 78000,
        source: "REFERRAL", status: "CONTACTED", score: 72,
        scoreReason: "Moderate debt, seasonal business, showed interest",
        assignedToId: closer.id,
        lastContactedAt: new Date("2026-05-20"),
        nextFollowUpAt: new Date("2026-06-03"),
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Brightside Landscaping", contactName: "Tom Peters",
        phone: "+15553334444", email: "tom@brightsidelandscaping.com",
        industry: "Landscaping", annualRevenue: 190000, totalDebtEst: 42000,
        source: "COLD_CALL", status: "QUALIFIED", score: 91,
        scoreReason: "Ready to enroll, has documentation, motivated",
        assignedToId: closer.id,
        lastContactedAt: new Date("2026-05-25"),
        nextFollowUpAt: new Date("2026-05-30"),
      },
    }),
    prisma.lead.create({
      data: {
        businessName: "Downtown Dental Practice", contactName: "Dr. Lisa Chen",
        phone: "+15556667777", email: "lisa@downtowndental.com",
        industry: "Healthcare", annualRevenue: 620000, totalDebtEst: 210000,
        source: "PURCHASED_LIST", status: "NEW", score: 78,
        scoreReason: "High debt amount, professional practice, good revenue",
      },
    }),
  ]);

  const campaign = await prisma.campaign.create({
    data: {
      name: "May New Lead Blitz",
      description: "Outreach to all new leads",
      dialerMode: "POWER", status: "ACTIVE",
      script: "Hi, this is {agent_name} from Coastal Debt Solutions...",
      startTime: "09:00", endTime: "18:00",
      contacts: { create: leads.map((l, i) => ({ leadId: l.id, priority: leads.length - i })) },
      agents: { create: [{ userId: closer.id }] },
    },
  });

  console.log("\nSeed complete!");
  console.log(`  Roles:            ${ROLES.length}`);
  console.log(`  Permission sets:  ${PERM_SETS.length}`);
  console.log(`  PermSet groups:   ${PSGS.length}`);
  console.log(`  Profiles:         ${PROFILES.length}`);
  console.log(`  Queues:           ${QUEUES.length}`);
  console.log(`  Users:            5 (admin, sales mgr, closer, csa, negotiator)`);
  console.log(`  Leads:            ${leads.length}`);
  console.log(`  Campaign:         ${campaign.name}`);
  console.log(`\n  Logins (all password123):`);
  console.log(`    bar@coastaldebt.com    — System Administrator`);
  console.log(`    sarah@coastaldebt.com  — Sales Manager`);
  console.log(`    john@coastaldebt.com   — Closer`);
  console.log(`    lisa@coastaldebt.com   — CSA`);
  console.log(`    mike@coastaldebt.com   — Debt Negotiator`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
