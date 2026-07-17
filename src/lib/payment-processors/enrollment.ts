/**
 * Processor enrollment - creates the client, bank account, and initial debit
 * schedule at SAS or RAM for a newly signed deal. Port of SF
 * ProcessorCreateAPI/SASApi.createClient + RAMApi.createClientService.
 *
 * Flow (SAS): GetCustomerRecords duplicate check -> CreateTrustAccount ->
 *   SetPaymentMethod -> mark drafts PENDING -> SetDebitSchedule (existing
 *   outbound drain).
 * Flow (RAM): NewClient (Method: CreateClient) -> AddUpdateClientBanking ->
 *   PayScheduleAddSingle per draft (existing outbound drain).
 *
 * SAME TEST-MODE GATES as the draft push: SAS_OUTBOUND_MODE / RAM_OUTBOUND_MODE.
 * In test mode every payload journals to ProcessorSyncLog as DRY_RUN and no
 * account/draft state changes.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { sasRawCall } from "./sas";
import { ramTransport } from "./ram";
import { sasOutboundMode } from "./sas-outbound";
import { ramOutboundMode } from "./ram-outbound";
import { drainProcessorQueues } from "./outbound";

export interface EnrollResult {
  ok: boolean;
  mode: "test" | "live";
  processor: "SAS" | "RAM";
  steps: Array<{ step: string; status: "DRY_RUN" | "SUCCESS" | "FAILED" | "SKIPPED"; detail?: string }>;
  error?: string;
}

function fail(processor: "SAS" | "RAM", mode: "test" | "live", error: string): EnrollResult {
  return { ok: false, mode, processor, steps: [], error };
}

async function journal(provider: string, method: string, mode: string, status: string, payload: unknown, response?: unknown, error?: string) {
  await prisma.processorSyncLog.create({
    data: {
      provider,
      method,
      mode,
      status,
      payload: payload as Prisma.InputJsonValue,
      response: (response ?? undefined) as Prisma.InputJsonValue | undefined,
      error: error ?? null,
      draftIds: [],
    },
  });
}

/** mm/dd/yyyy for SF-style date strings; SAS/RAM accept both this and ISO. */
function dateStr(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function enrollClient(accountId: string, processorArg?: "SAS" | "RAM"): Promise<EnrollResult> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      primaryContact: true,
      programPlans: {
        orderBy: { createdAt: "desc" },
        where: { status: "ACTIVE" },
        take: 1,
        include: { drafts: { where: { status: { in: ["SCHEDULED", "RETRYING"] } }, orderBy: { scheduledDate: "asc" } }, processor: true },
      },
      opportunities: { orderBy: { createdAt: "desc" }, take: 1, select: { totalDebt: true } },
    },
  });
  if (!account) return fail("SAS", "test", "Account not found");

  const plan = account.programPlans[0];
  const processor: "SAS" | "RAM" =
    processorArg ??
    (plan?.processor?.code === "RAM" ? "RAM" : account.paymentProcessor === "RAM" ? "RAM" : "SAS");
  const mode = processor === "SAS" ? sasOutboundMode() : ramOutboundMode();

  // ---- Guardrails -------------------------------------------------------
  if (processor === "SAS" && account.externalSasId) {
    return fail(processor, mode, `Already enrolled with SAS (customer ${account.externalSasId}). Use the payment grid to manage the schedule.`);
  }
  if (processor === "RAM" && account.externalRamId) {
    return fail(processor, mode, `Already enrolled with RAM (client ${account.externalRamId}).`);
  }
  if (!plan) return fail(processor, mode, "No ACTIVE program plan on this account - sign a contract first.");
  if (plan.drafts.length === 0) return fail(processor, mode, "The program plan has no scheduled drafts to enroll.");
  if (!account.bankRoutingNumber || !account.bankAccountNumber) {
    return fail(processor, mode, "Bank routing + account number are required (Bank Details card).");
  }
  const contact = account.primaryContact;
  const firstName = contact?.firstName || account.name.split(" ")[0];
  const lastName = contact?.lastName || account.name.split(" ").slice(1).join(" ") || account.name;
  const email = account.email ?? contact?.email;
  const phone = account.phone ?? contact?.phone;
  if (!email) return fail(processor, mode, "Client email is required for enrollment.");

  // SSN/TIN + client number come from the SF snapshot (SSN__c / Client_Number__c).
  let ssn = account.ein ?? "";
  let clientNumberSf = "";
  try {
    const sf = account.sfDataJson ? (JSON.parse(account.sfDataJson) as Record<string, unknown>) : {};
    if (sf["SSN__c"]) ssn = String(sf["SSN__c"]);
    if (sf["Client_Number__c"]) clientNumberSf = String(sf["Client_Number__c"]);
  } catch { /* keep ein */ }
  if (!ssn) return fail(processor, mode, "SSN or EIN is required for enrollment.");

  const remoteId = account.sfId ?? account.id; // SF-compatible RemoteID convention
  const totalDebt = account.currentTotalDebt ?? account.opportunities[0]?.totalDebt ?? 0;
  const steps: EnrollResult["steps"] = [];

  if (processor === "SAS") {
    // ---- 1. duplicate check (live even in test mode - read-only) --------
    try {
      const dup = await sasRawCall("GetCustomerRecords", { RemoteID: remoteId });
      const rows = dup.ProcessData ? (JSON.parse(dup.ProcessData) as Array<{ id?: number | string }>) : [];
      if (rows.length === 1 && rows[0]?.id != null) {
        const existingId = String(rows[0].id);
        await prisma.account.update({ where: { id: accountId }, data: { externalSasId: existingId } });
        return fail(processor, mode, `SAS already has this client (customer ${existingId}) - id saved to the account. No duplicate created.`);
      }
      steps.push({ step: "Duplicate check", status: "SUCCESS", detail: "no existing SAS customer" });
    } catch (e) {
      return fail(processor, mode, `SAS duplicate check failed: ${(e as Error).message}`);
    }

    // ---- 2. CreateTrustAccount ------------------------------------------
    const clientPayload = {
      RemoteID: remoteId,
      FirstName: firstName,
      LastName: lastName,
      Company: account.name,
      SsnTid: ssn,
      Dob: contact?.birthdate ? dateStr(contact.birthdate) : "",
      Email: email,
      Phone1: phone ?? "",
      Address1: account.billingStreet ?? "",
      City: account.billingCity ?? "",
      State: account.billingState ?? "",
      PostalCode: account.billingZip ?? "",
      Country: account.billingCountry ?? "US",
      TotalValue: String(totalDebt),
      InvoiceNumber: clientNumberSf,
      StartDate: dateStr(plan.firstDraftDate ?? plan.startDate),
      EndDate: dateStr(plan.startDate ? new Date(new Date(plan.startDate).setMonth(plan.startDate.getMonth() + plan.termMonths)) : null),
    };
    const bankPayload = {
      RemoteID: remoteId,
      BankAccountNumber: account.bankAccountNumber,
      BankRoutingNumber: account.bankRoutingNumber,
      PaymentType: account.bankAccountType === "Savings" ? "Savings" : "Checking",
    };

    if (mode === "test") {
      await journal("SAS", "CreateTrustAccount", "TEST", "DRY_RUN", clientPayload);
      await journal("SAS", "SetPaymentMethod", "TEST", "DRY_RUN", bankPayload);
      steps.push({ step: "CreateTrustAccount", status: "DRY_RUN" });
      steps.push({ step: "SetPaymentMethod", status: "DRY_RUN" });
      steps.push({ step: "SetDebitSchedule", status: "DRY_RUN", detail: `${plan.drafts.length} drafts would push after client creation` });
      return { ok: true, mode, processor, steps };
    }

    try {
      const created = await sasRawCall("CreateTrustAccount", clientPayload);
      await journal("SAS", "CreateTrustAccount", "LIVE", created.Success ? "SUCCESS" : "FAILED", clientPayload, created, created.Success ? undefined : created.Message ?? "Success=false");
      if (!created.Success) return { ok: false, mode, processor, steps, error: `CreateTrustAccount failed: ${created.Message ?? "Success=false"}` };
      // Customer id: envelope ID, else re-query by RemoteID.
      let customerId = created.ID != null ? String(created.ID) : null;
      if (!customerId) {
        const check = await sasRawCall("GetCustomerRecords", { RemoteID: remoteId });
        const rows = check.ProcessData ? (JSON.parse(check.ProcessData) as Array<{ id?: number | string }>) : [];
        customerId = rows.length === 1 && rows[0]?.id != null ? String(rows[0].id) : null;
      }
      if (!customerId) return { ok: false, mode, processor, steps, error: "SAS created the client but returned no customer id - check the journal." };
      steps.push({ step: "CreateTrustAccount", status: "SUCCESS", detail: `customer ${customerId}` });

      const bank = await sasRawCall("SetPaymentMethod", { ...bankPayload, CustomerID: customerId });
      await journal("SAS", "SetPaymentMethod", "LIVE", bank.Success ? "SUCCESS" : "FAILED", bankPayload, bank, bank.Success ? undefined : bank.Message ?? "Success=false");
      if (!bank.Success) return { ok: false, mode, processor, steps, error: `SetPaymentMethod failed: ${bank.Message ?? "Success=false"}` };
      steps.push({ step: "SetPaymentMethod", status: "SUCCESS" });

      await prisma.account.update({
        where: { id: accountId },
        data: { externalSasId: customerId, processorStatus: "Active", bankAccountSyncStatus: "Synced" },
      });
      await prisma.draft.updateMany({ where: { id: { in: plan.drafts.map((d) => d.id) } }, data: { processorSyncStatus: "PENDING" } });
      const drained = await drainProcessorQueues({ programPlanId: plan.id });
      const pushed = drained.sas.batches.filter((b) => b.status === "SUCCESS").length;
      steps.push({ step: "SetDebitSchedule", status: pushed > 0 ? "SUCCESS" : "FAILED", detail: `${pushed} batch(es) pushed` });
      return { ok: pushed > 0, mode, processor, steps, error: pushed > 0 ? undefined : "Client + bank created but the schedule push failed - see the journal." };
    } catch (e) {
      return { ok: false, mode, processor, steps, error: (e as Error).message };
    }
  }

  // ---- RAM ---------------------------------------------------------------
  const clientNumber = clientNumberSf || (account.sfId ?? account.id);
  const ramCreds = await prisma.integrationCredential.findFirst({ where: { provider: "RAM", isActive: true } });
  const cfg = (ramCreds?.config ?? {}) as Record<string, string>;
  const clientXml: Record<string, string> = {
    ClientID: clientNumber,
    Firstname: firstName,
    Lastname: lastName,
    EmailAddress: email,
    TaxID: ssn,
    StreetAddress: account.billingStreet ?? "",
    City: account.billingCity ?? "",
    ZIP: account.billingZip ?? "",
    StateAbbreviation: account.billingState ?? "",
    Phone1: phone ?? "",
    DOB1: contact?.birthdate ? dateStr(contact.birthdate) : "",
    AccountStatus: "ACTIVE",
    AffiliateID: cfg.affiliateId ?? "",
    FeeSplitGroupID: cfg.feeSplitGroupId ?? "",
    AccountHoldStatus: "NONE",
  };
  const bankXml: Record<string, string> = {
    clientid: clientNumber,
    Accountnumber: account.bankAccountNumber,
    NameonAccount: account.name,
    Routing: account.bankRoutingNumber,
    bankname: account.bankName ?? "",
    AccountType: account.bankAccountType === "Savings" ? "CONSUMER_DEBIT_SAVINGS" : "CONSUMER_DEBIT_CHECKING",
  };

  if (mode === "test") {
    await journal("RAM", "NewClient", "TEST", "DRY_RUN", clientXml);
    await journal("RAM", "AddUpdateClientBanking", "TEST", "DRY_RUN", bankXml);
    steps.push({ step: "NewClient", status: "DRY_RUN" });
    steps.push({ step: "AddUpdateClientBanking", status: "DRY_RUN" });
    steps.push({ step: "PayScheduleAddSingle", status: "DRY_RUN", detail: `${plan.drafts.length} drafts would push after client creation` });
    return { ok: true, mode, processor, steps };
  }

  try {
    const sessionId = await ramTransport.session();
    const toXml = (m: Record<string, string>) =>
      `<sessid>${ramTransport.escape(sessionId)}</sessid>` +
      Object.entries(m).map(([k, v]) => `<${k}>${ramTransport.escape(v)}</${k}>`).join("");

    const createRes = await ramTransport.call("NewClient", "CreateClient", toXml(clientXml));
    const createStrings = ramTransport.extract(createRes, "string");
    const createOk = createStrings.length > 0 && createStrings[0].toUpperCase() === "OK";
    await journal("RAM", "NewClient", "LIVE", createOk ? "SUCCESS" : "FAILED", clientXml, { strings: createStrings.slice(0, 4) }, createOk ? undefined : createStrings[0]);
    if (!createOk) return { ok: false, mode, processor, steps, error: `NewClient failed: ${createStrings[0] ?? "no response"}` };
    steps.push({ step: "NewClient", status: "SUCCESS", detail: `client ${clientNumber}` });

    const bankRes = await ramTransport.call("AddUpdateClientBanking", "AddUpdateBankAccount", toXml(bankXml));
    const bankStrings = ramTransport.extract(bankRes, "string");
    const bankOk = bankStrings.length > 0 && bankStrings[0].toUpperCase() === "OK";
    await journal("RAM", "AddUpdateClientBanking", "LIVE", bankOk ? "SUCCESS" : "FAILED", bankXml, { strings: bankStrings.slice(0, 4) }, bankOk ? undefined : bankStrings[0]);
    if (!bankOk) return { ok: false, mode, processor, steps, error: `AddUpdateClientBanking failed: ${bankStrings[0] ?? "no response"}` };
    steps.push({ step: "AddUpdateClientBanking", status: "SUCCESS" });

    await prisma.account.update({
      where: { id: accountId },
      data: { externalRamId: clientNumber, processorStatus: "Active", bankAccountSyncStatus: "Synced" },
    });
    await prisma.draft.updateMany({ where: { id: { in: plan.drafts.map((d) => d.id) } }, data: { processorSyncStatus: "PENDING" } });
    const drained = await drainProcessorQueues({ programPlanId: plan.id });
    const pushed = drained.ram.batches.filter((b) => b.status === "SUCCESS").length;
    steps.push({ step: "PayScheduleAddSingle", status: pushed > 0 ? "SUCCESS" : "FAILED", detail: `${pushed} draft(s) pushed` });
    return { ok: pushed > 0, mode, processor, steps, error: pushed > 0 ? undefined : "Client + bank created but the draft push failed - see the journal." };
  } catch (e) {
    return { ok: false, mode, processor, steps, error: (e as Error).message };
  }
}
