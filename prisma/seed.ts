import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import {
  LEAD_SUB_DISPOSITIONS,
  DISPOSITION_TO_STATUS,
  STAGE_TO_SUB_DISPOSITIONS,
  LEAD_STATUSES,
  OPP_STAGES,
  OPP_STAGE_TO_SUB_DISPOSITIONS,
} from "../src/lib/sf-canonical";
import { SYSTEM_VIEWS } from "../src/lib/list-views";

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
  // List views (no FK on this; nuke first for re-seed)
  await prisma.listView.deleteMany();
  // Phase 6 — emails / sms / templates / integrations / webhook events
  await prisma.emailMessage.deleteMany();
  await prisma.smsMessage.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.integrationCredential.deleteMany();
  await prisma.webhookEvent.deleteMany();
  // Phase 5 — case comments + cases
  await prisma.caseComment.deleteMany();
  await prisma.case.deleteMany();
  // Phase 4 — drop tasks/events
  await prisma.task.deleteMany();
  await prisma.event.deleteMany();
  await prisma.callFeedback.deleteMany();
  await prisma.transcript.deleteMany();
  await prisma.call.deleteMany();
  await prisma.campaignContact.deleteMany();
  await prisma.campaignAgent.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.negotiation.deleteMany();
  await prisma.payment.deleteMany();
  // Phase 3 entities
  await prisma.settlement.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.debitSchedule.deleteMany();
  await prisma.financialSummary.deleteMany();
  await prisma.paymentSummary.deleteMany();
  await prisma.document.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.client.deleteMany();
  await prisma.programPlan.deleteMany();
  await prisma.paymentProcessor.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.creditor.deleteMany();
  await prisma.accountContactRelation.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
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

  // ---------- SAMPLE BUSINESS DATA (Phase 2: Accounts + Contacts + Creditors) ----------
  console.log("Seeding sample accounts, contacts, creditors...");

  // Three creditors — these get referenced by debts in Phase 3
  const chase = await prisma.account.create({
    data: {
      recordType: "CREDITOR", name: "Chase Bank", type: "ORG",
      phone: "+18009352721", email: "collections@chase.com",
      website: "https://chase.com",
    },
  });
  await prisma.creditor.create({
    data: {
      accountId: chase.id, legalName: "JPMorgan Chase Bank, N.A.",
      collectionsPhone: "+18009352721", collectionsEmail: "collections@chase.com",
      settlementPolicy: "Typically accepts 40-50% on charged-off accounts.",
    },
  });

  const amex = await prisma.account.create({
    data: {
      recordType: "CREDITOR", name: "American Express", type: "ORG",
      phone: "+18005281234", email: "collections@aexp.com",
    },
  });
  await prisma.creditor.create({
    data: {
      accountId: amex.id, legalName: "American Express National Bank",
      collectionsPhone: "+18005281234",
      settlementPolicy: "Aggressive negotiators; often hold at 60%+ before settlement.",
    },
  });

  const capitalOne = await prisma.account.create({
    data: { recordType: "CREDITOR", name: "Capital One", type: "ORG", phone: "+18002584300" },
  });
  await prisma.creditor.create({
    data: { accountId: capitalOne.id, legalName: "Capital One, N.A.", collectionsPhone: "+18002584300" },
  });

  // Two sample CLIENT accounts (pre-conversion) — give UI something to show
  const acmeAccount = await prisma.account.create({
    data: {
      recordType: "BUSINESS_ACCOUNT", name: "Acme Construction LLC", type: "ORG",
      ein: "12-3456789", phone: "+15551234567", email: "bob@acmeconstruction.com",
      industry: "Construction", annualRevenue: 850000,
      ownerId: closer.id,
    },
  });
  const acmeContact = await prisma.contact.create({
    data: {
      firstName: "Bob", lastName: "Johnson", fullName: "Bob Johnson",
      email: "bob@acmeconstruction.com", phone: "+15551234567",
      title: "Owner",
      primaryAccountId: acmeAccount.id, ownerId: closer.id,
    },
  });
  await prisma.accountContactRelation.create({
    data: { accountId: acmeAccount.id, contactId: acmeContact.id, role: "Owner" },
  });

  const sunriseAccount = await prisma.account.create({
    data: {
      recordType: "BUSINESS_ACCOUNT", name: "Sunrise Restaurant Group", type: "ORG",
      ein: "98-7654321", phone: "+15559876543", email: "maria@sunrisegroup.com",
      industry: "Food Service", annualRevenue: 420000,
      ownerId: closer.id,
    },
  });
  const sunriseContact = await prisma.contact.create({
    data: {
      firstName: "Maria", lastName: "Garcia", fullName: "Maria Garcia",
      email: "maria@sunrisegroup.com", phone: "+15559876543", title: "Managing Partner",
      primaryAccountId: sunriseAccount.id, ownerId: closer.id,
    },
  });
  await prisma.accountContactRelation.create({
    data: { accountId: sunriseAccount.id, contactId: sunriseContact.id, role: "Managing Partner" },
  });

  console.log("Seeding payment processors + program plans...");

  // Three processors — most settlement shops use one of these
  const ram = await prisma.paymentProcessor.create({
    data: { name: "RAM Payment Services", code: "RAM", description: "Dedicated trust account processor", isActive: true },
  });
  await prisma.paymentProcessor.create({
    data: { name: "Reliant Account Management", code: "RELIANT", description: "Alternative trust processor", isActive: true },
  });
  await prisma.paymentProcessor.create({
    data: { name: "Global Holdings Group", code: "GHG", description: "Backup processor", isActive: false },
  });

  // ProgramPlan for Acme — active, with debts, drafts, offers, settlements
  const acmePlan = await prisma.programPlan.create({
    data: {
      recordType: "DEBT_SETTLEMENT",
      accountId: acmeAccount.id,
      processorId: ram.id,
      assignedToId: negotiator.id,
      status: "ACTIVE",
      startDate: new Date("2026-02-01"),
      termMonths: 36,
      monthlyAmount: 875,
      totalEnrolledDebt: 125000,
      bankAccountLast4: "4321",
      bankRoutingLast4: "9988",
      signedDate: new Date("2026-01-25"),
      notes: "Standard 36-month plan, monthly draft on the 1st",
    },
  });
  await prisma.debitSchedule.create({
    data: {
      programPlanId: acmePlan.id,
      frequency: "MONTHLY",
      dayOfMonth: 1,
      amount: 875,
      startDate: new Date("2026-02-01"),
      nextRunDate: new Date("2026-06-01"),
    },
  });
  // 3 SUCCESS drafts, 1 FAILED draft, 1 SCHEDULED
  const draft1 = await prisma.draft.create({
    data: {
      programPlanId: acmePlan.id, scheduledDate: new Date("2026-02-02"), amount: 875,
      status: "SUCCESS", processedAt: new Date("2026-02-02"), settledAt: new Date("2026-02-04"),
    },
  });
  await prisma.draft.create({
    data: {
      programPlanId: acmePlan.id, scheduledDate: new Date("2026-03-02"), amount: 875,
      status: "SUCCESS", processedAt: new Date("2026-03-02"), settledAt: new Date("2026-03-04"),
    },
  });
  await prisma.draft.create({
    data: {
      programPlanId: acmePlan.id, scheduledDate: new Date("2026-04-01"), amount: 875,
      status: "SUCCESS", processedAt: new Date("2026-04-01"), settledAt: new Date("2026-04-03"),
    },
  });
  await prisma.draft.create({
    data: {
      programPlanId: acmePlan.id, scheduledDate: new Date("2026-05-01"), amount: 875,
      status: "FAILED", attemptNumber: 1, processedAt: new Date("2026-05-01"),
      returnCode: "R01", returnReason: "Insufficient funds",
    },
  });
  await prisma.draft.create({
    data: {
      programPlanId: acmePlan.id, scheduledDate: new Date("2026-05-08"), amount: 875,
      status: "SCHEDULED", attemptNumber: 2, parentDraftId: draft1.id,
    },
  });
  await prisma.fee.create({
    data: {
      programPlanId: acmePlan.id, recordType: "SETUP", amount: 250,
      chargedDate: new Date("2026-02-02"), status: "CHARGED", chargedById: admin.id,
    },
  });
  await prisma.fee.create({
    data: {
      programPlanId: acmePlan.id, recordType: "MONTHLY_ADMIN", amount: 49,
      chargedDate: new Date("2026-03-02"), status: "CHARGED", chargedById: admin.id,
    },
  });

  // A Debt tied to Chase under acmePlan, with an Offer + Settlement
  const acmeDebt = await prisma.debt.create({
    data: {
      programPlanId: acmePlan.id,
      creditorId: (await prisma.creditor.findFirst({ where: { account: { name: "Chase Bank" } } }))!.id,
      creditorName: "Chase Bank",
      accountNumber: "**** 8421",
      originalBalance: 18500,
      currentBalance: 18500,
      enrolledBalance: 18500,
      status: "NEGOTIATING",
    },
  });
  const acmeOffer = await prisma.offer.create({
    data: {
      debtId: acmeDebt.id, direction: "FROM_US",
      amountOffered: 7400, percentOffered: 0.4,
      status: "ACCEPTED", createdById: negotiator.id,
      termsNotes: "Lump-sum payoff within 30 days",
    },
  });
  await prisma.settlement.create({
    data: {
      debtId: acmeDebt.id, offerId: acmeOffer.id, recordType: "STANDARD",
      settledAmount: 7400, savingsAmount: 11100, savingsPercent: 0.6,
      settledDate: new Date("2026-04-15"),
      payoffDueDate: new Date("2026-05-15"), status: "PENDING_PAYOFF",
      approvedById: admin.id,
      notes: "Chase accepted 40% — strong outcome",
    },
  });

  // FinancialSummary for Acme — intake snapshot
  await prisma.financialSummary.create({
    data: {
      accountId: acmeAccount.id,
      monthlyIncome: 70000, monthlyExpenses: 62500,
      disposableIncome: 7500,
      totalAssets: 320000, totalLiabilities: 280000,
      notes: "Intake at enrollment", capturedById: closer.id,
    },
  });

  // Smaller ProgramPlan for Sunrise — proposed, not yet active
  await prisma.programPlan.create({
    data: {
      recordType: "DEBT_SETTLEMENT",
      accountId: sunriseAccount.id,
      processorId: ram.id,
      status: "PROPOSED",
      startDate: new Date("2026-06-01"),
      termMonths: 24,
      monthlyAmount: 520,
      totalEnrolledDebt: 78000,
      notes: "Awaiting signed contract",
    },
  });

  console.log("Seeding tasks + events...");

  // Tasks on Acme: a completed disposition + a future follow-up + a past-due call
  await prisma.task.create({
    data: {
      recordType: "DISPOSITION",
      subject: "Confirmed program details with Bob — ready to send contract",
      type: "CALL", status: "COMPLETED",
      accountId: acmeAccount.id, contactId: acmeContact.id,
      ownerId: closer.id, completedAt: new Date("2026-01-24"),
      disposition: "INTERESTED", outcome: "Sent for signature",
      notes: "Bob asked about restructuring two business lines too — flagged for upsell",
    },
  });
  await prisma.task.create({
    data: {
      recordType: "ACTIVITY",
      subject: "Follow up on Chase settlement payoff",
      type: "CALL", status: "NOT_STARTED", priority: "HIGH",
      accountId: acmeAccount.id, contactId: acmeContact.id,
      ownerId: negotiator.id,
      dueDate: new Date("2026-06-08"),
    },
  });
  await prisma.task.create({
    data: {
      recordType: "ACTIVITY",
      subject: "Address failed May draft — contact Bob re: bank balance",
      type: "CALL", status: "IN_PROGRESS", priority: "HIGH",
      accountId: acmeAccount.id, contactId: acmeContact.id, programPlanId: acmePlan.id,
      ownerId: csa.id,
      dueDate: new Date("2026-05-05"),
    },
  });
  // Sunrise — open task for the proposed plan
  await prisma.task.create({
    data: {
      recordType: "ACTIVITY",
      subject: "Send DocuSign for Sunrise Restaurant program contract",
      type: "EMAIL", status: "NOT_STARTED", priority: "NORMAL",
      accountId: sunriseAccount.id, contactId: sunriseContact.id,
      ownerId: closer.id,
      dueDate: new Date("2026-06-03"),
    },
  });

  // Event: a scheduled call with Acme
  await prisma.event.create({
    data: {
      recordType: "EVENT",
      subject: "Quarterly check-in with Bob Johnson",
      description: "Review progress, discuss remaining debts, set expectations for next 3 months",
      accountId: acmeAccount.id, contactId: acmeContact.id,
      ownerId: closer.id,
      startAt: new Date("2026-06-10T15:00:00Z"),
      endAt: new Date("2026-06-10T15:30:00Z"),
      status: "SCHEDULED",
    },
  });
  // EVENT_DISPOSITION: log a past meeting that already happened
  await prisma.event.create({
    data: {
      recordType: "EVENT_DISPOSITION",
      subject: "Intake meeting with Acme — Bob + spouse",
      accountId: acmeAccount.id, contactId: acmeContact.id,
      ownerId: closer.id,
      startAt: new Date("2026-01-20T14:00:00Z"),
      endAt: new Date("2026-01-20T15:00:00Z"),
      status: "COMPLETED",
      disposition: "QUALIFIED", outcome: "Signed up for Debt Settlement program",
      notes: "Solid affordability profile, motivated, clear understanding of timeline",
    },
  });

  console.log("Seeding cases + comments...");

  const csL1 = await prisma.group.findUnique({ where: { developerName: "CS_L1" } });
  const csL2 = await prisma.group.findUnique({ where: { developerName: "CS_L2" } });

  // C-0001: Failed-draft payment issue (IN_PROGRESS, assigned to CSA)
  const caseFailedDraft = await prisma.case.create({
    data: {
      caseNumber: "C-0001",
      recordType: "PAYMENT_ISSUE",
      subject: "Failed May draft — insufficient funds",
      description: "Client's May 1 draft of $875 returned R01. Need to reach out and reschedule.",
      status: "IN_PROGRESS", priority: "HIGH", origin: "PHONE", escalationLevel: "L1",
      accountId: acmeAccount.id, contactId: acmeContact.id, programPlanId: acmePlan.id,
      ownerId: csa.id, ownerGroupId: csL1?.id ?? null,
      createdById: admin.id,
      firstResponseAt: new Date("2026-05-02"),
      slaDueAt: new Date("2026-05-09"),
    },
  });
  await prisma.caseComment.createMany({
    data: [
      { caseId: caseFailedDraft.id, authorId: csa.id, body: "Called Bob; left voicemail at 4:30pm.", isInternal: true },
      { caseId: caseFailedDraft.id, authorId: csa.id, body: "Bob called back, wants to reschedule for the 8th. Confirmed bank balance will be sufficient.", isInternal: true },
    ],
  });

  // C-0002: Skip payment request — escalated, waiting on approval
  await prisma.case.create({
    data: {
      caseNumber: "C-0002",
      recordType: "SKIP_PAYMENT",
      subject: "Skip payment for June — client traveling for surgery",
      description: "Client requests one-month skip due to hospital stay. Resume July 1.",
      status: "ESCALATED", priority: "NORMAL", origin: "PHONE", escalationLevel: "L2",
      accountId: acmeAccount.id, programPlanId: acmePlan.id,
      ownerGroupId: csL2?.id ?? null,
      requiresApproval: true,
      createdById: csa.id,
      firstResponseAt: new Date("2026-05-28"),
    },
  });

  // C-0003: Document request (NEW at L1)
  await prisma.case.create({
    data: {
      caseNumber: "C-0003",
      recordType: "DOCUMENT_REQUEST",
      subject: "Client needs copy of welcome packet",
      description: "Bob misplaced welcome materials; resend digital copy via email.",
      status: "NEW", priority: "LOW", origin: "EMAIL", escalationLevel: "L1",
      accountId: acmeAccount.id, contactId: acmeContact.id,
      ownerGroupId: csL1?.id ?? null,
      createdById: admin.id,
    },
  });

  // C-0004: Cancellation — resolved, approved
  await prisma.case.create({
    data: {
      caseNumber: "C-0004",
      recordType: "CANCELLATION",
      subject: "Sunrise Restaurant cancellation reversal",
      description: "Maria initially asked to cancel; agreed to continue after Closer call.",
      status: "RESOLVED", priority: "URGENT", origin: "PHONE", escalationLevel: "L1",
      accountId: sunriseAccount.id, contactId: sunriseContact.id,
      ownerId: csa.id,
      requiresApproval: true,
      approvedById: admin.id, approvedAt: new Date("2026-05-25"),
      approvalNotes: "Approved retention; offered one-month fee waiver.",
      firstResponseAt: new Date("2026-05-24"),
      resolvedAt: new Date("2026-05-26"),
      createdById: csa.id,
    },
  });

  console.log("Seeding email templates, communications, integrations...");

  const tplWelcome = await prisma.emailTemplate.create({
    data: {
      name: "Welcome — Program Enrollment", developerName: "Welcome_Enrollment",
      subject: "Welcome to Coastal Debt, {{contact.firstName}}!",
      bodyText: "Hi {{contact.firstName}},\n\nWelcome aboard! Your {{programPlan.termMonths}}-month program is set to start on {{programPlan.startDate}}. Your monthly draft of ${{programPlan.monthlyAmount}} will pull on the 1st of each month.\n\n— Coastal Team",
      folder: "Onboarding", isActive: true, createdById: admin.id,
    },
  });
  await prisma.emailTemplate.create({
    data: {
      name: "Failed Draft — Notify Client", developerName: "Failed_Draft_Notify",
      subject: "Important: Your recent payment didn't go through",
      bodyText: "Hi {{contact.firstName}},\n\nYour {{programPlan.monthlyAmount}} draft on {{draft.scheduledDate}} returned with code {{draft.returnCode}}. We'll re-attempt in 5 business days.",
      folder: "Operations", isActive: true, createdById: admin.id,
    },
  });
  await prisma.emailTemplate.create({
    data: {
      name: "Settlement Accepted — Congratulations", developerName: "Settlement_Accepted",
      subject: "Great news, {{contact.firstName}} — {{creditor.legalName}} accepted",
      bodyText: "We negotiated a settlement of ${{settlement.settledAmount}} against ${{debt.originalBalance}} — saving you ${{settlement.savingsAmount}}.",
      folder: "Negotiations", isActive: true, createdById: admin.id,
    },
  });

  await prisma.emailMessage.create({
    data: {
      direction: "OUTBOUND", status: "DELIVERED",
      fromAddress: "team@coastaldebt.com", toAddresses: acmeContact.email!,
      subject: "Welcome to Coastal Debt, Bob!",
      bodyText: "Welcome aboard, Bob! Your 36-month program is set...",
      templateId: tplWelcome.id,
      accountId: acmeAccount.id, contactId: acmeContact.id,
      ownerId: closer.id,
      provider: "sendgrid", providerMessageId: "sg_msg_abc123",
      sentAt: new Date("2026-02-01T15:00:00Z"),
      deliveredAt: new Date("2026-02-01T15:00:12Z"),
    },
  });
  await prisma.emailMessage.create({
    data: {
      direction: "OUTBOUND", status: "DRAFT",
      fromAddress: "team@coastaldebt.com", toAddresses: sunriseContact.email!,
      subject: "Sunrise Restaurant — DocuSign enclosed",
      bodyText: "Hi Maria, please find your enrollment contract attached for signature.",
      accountId: sunriseAccount.id, contactId: sunriseContact.id, ownerId: closer.id,
    },
  });

  await prisma.smsMessage.create({
    data: {
      direction: "OUTBOUND", status: "DELIVERED",
      fromNumber: "+18005551234", toNumber: acmeContact.phone!,
      body: "Hi Bob — just confirming your draft is rescheduled for May 8. Reply Y to confirm.",
      accountId: acmeAccount.id, contactId: acmeContact.id, ownerId: csa.id,
      provider: "twilio", providerMessageId: "SM_abc999",
      sentAt: new Date("2026-05-03T18:00:00Z"),
      deliveredAt: new Date("2026-05-03T18:00:04Z"),
    },
  });
  await prisma.smsMessage.create({
    data: {
      direction: "INBOUND", status: "RECEIVED",
      fromNumber: acmeContact.phone!, toNumber: "+18005551234",
      body: "Y — thanks!",
      accountId: acmeAccount.id, contactId: acmeContact.id,
      provider: "twilio",
    },
  });

  await prisma.integrationCredential.create({
    data: {
      provider: "TWILIO", name: "Primary Twilio account", isActive: true,
      config: {
        accountSid: "AC_PLACEHOLDER_FILL_ME",
        apiKey: "SK_PLACEHOLDER",
        apiSecret: "SECRET_PLACEHOLDER",
        outboundNumber: "+18005551234",
      },
      createdById: admin.id,
    },
  });
  await prisma.integrationCredential.create({
    data: {
      provider: "DOCUSIGN", name: "Production DocuSign account", isActive: false,
      config: { accountId: "PLACEHOLDER", integrationKey: "PLACEHOLDER" },
      createdById: admin.id,
    },
  });

  await prisma.webhookEvent.create({
    data: {
      source: "PAYMENT_PROCESSOR", endpoint: "/api/webhooks/payment-processor",
      ipAddress: "203.0.113.42",
      payload: { draftId: "test-draft-id", status: "SUCCESS" },
      signatureValid: true, status: "PROCESSED",
      resultNote: "test-draft-id → SUCCESS",
      processedAt: new Date("2026-04-01T16:00:00Z"),
    },
  });

  console.log("Seeding sample leads + campaign...");
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        businessName: "Acme Construction LLC", contactName: "Bob Johnson",
        phone: "+15551234567", email: "bob@acmeconstruction.com",
        ein: "12-3456789", industry: "Construction",
        annualRevenue: 850000, totalDebtEst: 125000,
        source: "WEBSITE", status: "New", score: 85,
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
        source: "REFERRAL", status: "Working Lead", score: 72,
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
        source: "COLD_CALL", status: "Working Lead", score: 91,
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
        source: "PURCHASED_LIST", status: "New", score: 78,
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

  // ---------- LIST VIEWS (system views per entity) ----------
  console.log("Seeding list views...");
  let listViewCount = 0;
  for (const [entity, views] of Object.entries(SYSTEM_VIEWS)) {
    for (const v of views) {
      await prisma.listView.create({
        data: {
          entity,
          name: v.name,
          developerName: v.developerName,
          filters: v.filters as object,
          sortField: v.sortField ?? null,
          sortDir: v.sortDir ?? "desc",
          isShared: true,
          isSystem: true,
          isPinned: !!v.isPinned,
          sortOrder: v.sortOrder ?? 0,
        },
      });
      listViewCount++;
    }
  }

  // ---------- DISPOSITIONS (SF Lead picklist — sub-dispositions per stage) ----------
  console.log("Seeding dispositions...");
  await prisma.disposition.deleteMany({ where: { entity: "Lead" } });
  let dispositionCount = 0;
  // First: per-stage sub-dispositions (used by the Disposition modal)
  for (const stage of LEAD_STATUSES) {
    const values = STAGE_TO_SUB_DISPOSITIONS[stage];
    for (const [i, value] of values.entries()) {
      await prisma.disposition.create({
        data: {
          entity: "Lead",
          category: "SUB_DISPOSITION",
          value,
          label: value,
          stage,
          sortOrder: i,
          leadStatusMapping: stage,
        },
      });
      dispositionCount++;
    }
  }
  // Also keep flat fallback for the master picklist setup page (no stage gate)
  for (const [i, d] of LEAD_SUB_DISPOSITIONS.entries()) {
    const exists = await prisma.disposition.findFirst({
      where: { entity: "Lead", category: "SUB_DISPOSITION", value: d.value, stage: null },
    });
    if (!exists) {
      await prisma.disposition.create({
        data: {
          entity: "Lead",
          category: "SUB_DISPOSITION",
          value: d.value,
          label: d.label,
          stage: null,
          sortOrder: 1000 + i,
          leadStatusMapping: DISPOSITION_TO_STATUS[d.value] ?? "Working Lead",
        },
      });
      dispositionCount++;
    }
  }

  // Opportunity dispositions per stage
  await prisma.disposition.deleteMany({ where: { entity: "Opportunity" } });
  for (const stage of OPP_STAGES) {
    const values = OPP_STAGE_TO_SUB_DISPOSITIONS[stage];
    for (const [i, value] of values.entries()) {
      await prisma.disposition.create({
        data: {
          entity: "Opportunity",
          category: "SUB_DISPOSITION",
          value,
          label: value,
          stage,
          sortOrder: i,
          leadStatusMapping: stage,
        },
      });
      dispositionCount++;
    }
  }

  console.log("\nSeed complete!");
  console.log(`  List Views:       ${listViewCount}`);
  console.log(`  Dispositions:     ${dispositionCount} (Lead sub-dispositions, SF parity)`);
  console.log(`  Roles:            ${ROLES.length}`);
  console.log(`  Permission sets:  ${PERM_SETS.length}`);
  console.log(`  PermSet groups:   ${PSGS.length}`);
  console.log(`  Profiles:         ${PROFILES.length}`);
  console.log(`  Queues:           ${QUEUES.length}`);
  console.log(`  Users:            5 (admin, sales mgr, closer, csa, negotiator)`);
  console.log(`  Accounts:         5 (2 clients, 3 creditors)`);
  console.log(`  Contacts:         2`);
  console.log(`  Creditors:        3 (Chase, Amex, Capital One)`);
  console.log(`  Processors:       3 (RAM, Reliant, GHG)`);
  console.log(`  ProgramPlans:     2 (1 ACTIVE w/ drafts, 1 PROPOSED)`);
  console.log(`  Drafts:           5 (3 SUCCESS, 1 FAILED, 1 SCHEDULED retry)`);
  console.log(`  Offers:           1 (ACCEPTED)`);
  console.log(`  Settlements:      1 (PENDING_PAYOFF, 60% savings)`);
  console.log(`  Fees:             2 (Setup + Monthly Admin)`);
  console.log(`  FinancialSummary: 1 snapshot`);
  console.log(`  Tasks:            4 (1 disposition + 3 open)`);
  console.log(`  Events:           2 (1 upcoming + 1 past intake)`);
  console.log(`  Cases:            4 (1 IN_PROGRESS, 1 ESCALATED w/ approval, 1 NEW, 1 RESOLVED)`);
  console.log(`  Case comments:    2 (on failed-draft case)`);
  console.log(`  Email templates:  3 (Welcome / Failed Draft / Settlement Accepted)`);
  console.log(`  Emails:           2 (1 DELIVERED welcome + 1 DRAFT to Sunrise)`);
  console.log(`  SMS:              2 (1 outbound + 1 inbound reply on Acme)`);
  console.log(`  Integrations:     2 (Twilio placeholder + DocuSign placeholder)`);
  console.log(`  Webhook events:   1 (PAYMENT_PROCESSOR test)`);
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
