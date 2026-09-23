import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { runReportWithAccess } from "@/lib/reports/runner";
import { captureDailyPipeline } from "@/lib/reports/pipeline-history";

describe.skipIf(process.env.CRM_REPORT_DB_TEST !== "1")("advanced reports PostgreSQL integration", () => {
  it("joins, scopes, totals and captures daily observations atomically", async () => {
    expect(process.env.DATABASE_URL).toBe("postgresql://crm_list_test@127.0.0.1:5449/crm_parity_test");
    const rollback = new Error("ROLLBACK_VERIFIED_FIXTURES");
    try {
      await prisma.$transaction(async tx => {
        const db = await tx.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
        expect(db[0].name).toBe("crm_parity_test");
        const user = await tx.user.create({ data: { name: "Report fixture", email: `reports-${Date.now()}@example.invalid`, passwordHash: "disabled" } });
        const account = await tx.account.create({ data: { name: "Report fixture", ownerId: user.id } });
        const lead = await tx.lead.create({ data: { businessName: "Fixture", contactName: "Fixture", phone: "000", assignedToId: user.id } });
        const opp = await tx.opportunity.create({ data: { name: "Fixture deal", accountId: account.id, assignedToId: user.id, totalDebt: 100, amount: 50, stage: "Closed Won" } });
        await tx.opportunity.create({ data: { name: "Fixture deal 2", accountId: account.id, assignedToId: user.id, totalDebt: 900, amount: 90 } });
        const client = await tx.client.create({ data: { leadId: lead.id, opportunityId: opp.id, programStartDate: new Date(), programLength: 12, monthlyPayment: 50, totalEnrolledDebt: 100 } });
        const debt = await tx.debt.create({ data: { opportunityId: opp.id, clientId: client.id, creditorName: "Fixture creditor", originalBalance: 100, currentBalance: 80, enrolledBalance: 100 } });
        await tx.payment.createMany({ data: [20, 30].map(amount => ({ clientId: client.id, debtId: debt.id, amount, type: "CLIENT_PAYMENT", status: "COMPLETED", scheduledDate: new Date() })) });
        const access = { userId: user.id, isAdmin: false, ownerIds: [user.id], permissions: ["Reports.View", "Opportunity.View", "Account.View", "Lead.View", "Payment.View", "Debt.View"] };
        const result = await runReportWithAccess({ objectType: "Account", columns: ["name", "related.opportunityAmount", "related.debtBalance", "related.paymentAmount"], filters: [], rowLimit: 1 }, access, tx);
        expect(result).not.toHaveProperty("error");
        if ("error" in result) throw Error(result.error);
        expect(result.rows).toEqual([expect.objectContaining({ "related.opportunityAmount": 140, "related.debtBalance": 80, "related.paymentAmount": 50 })]);
        const payments = await runReportWithAccess({ objectType: "Payment", columns: ["amount", "client.opportunity.account.name", "debt.creditorName"], filters: [], rowLimit: 1, summarize: [{field:"amount",kind:"sum"}] }, access, tx);
        expect(payments).toMatchObject({ rowCount: 2, displayedRowCount: 1, totals: { amount_sum: 50 }, rows: [{ "client.opportunity.account.name": "Report fixture", "debt.creditorName": "Fixture creditor" }] });
        const hidden = await runReportWithAccess({ objectType:"Payment", columns:["amount","client.opportunity.account.name"], filters:[] }, {...access,permissions:access.permissions.filter(p=>p!=="Account.View")}, tx);
        expect(hidden).toMatchObject({rowCount:2,rows:[{"client.opportunity.account.name":null},{"client.opportunity.account.name":null}]});
        const noPayments = await runReportWithAccess({objectType:"Payment",columns:["amount"],filters:[]},{...access,permissions:access.permissions.filter(p=>p!=="Payment.View")},tx);
        expect(noPayments).toMatchObject({rowCount:0});
        const date = new Date("2099-01-01T00:00:00Z");
        expect(await captureDailyPipeline(date, tx)).toBeGreaterThanOrEqual(2);
        expect(await captureDailyPipeline(date, tx)).toBe(0);
        const history = await runReportWithAccess({objectType:"OpportunitySnapshot",columns:["stage","amount","capturedAt"],filters:[],groupBy:"stage",summarize:[{field:"amount",kind:"sum"}]},access,tx);
        expect(history).toMatchObject({rowCount:2,totals:{amount_sum:140}});
        expect(await tx.opportunitySnapshot.findFirst({where:{opportunityId:opp.id,capturedAt:date}})).toMatchObject({isWon:true,isClosed:true,amount:50});
        throw rollback;
      }, {timeout:30000});
    } catch(error) { if(error!==rollback)throw error; }
    finally {await prisma.$disconnect();}
  });
});
