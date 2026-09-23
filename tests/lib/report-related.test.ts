import {expect,it,vi} from "vitest";
const db=vi.hoisted(()=>({opps:vi.fn(),debts:vi.fn(),payments:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{opportunity:{findMany:db.opps},debt:{findMany:db.debts},payment:{findMany:db.payments}}}));
vi.mock("@/lib/analytics-access",()=>({analyticsScope:(_a:unknown,model:string)=>({allowedModel:model})}));
vi.mock("@/lib/permissions",()=>({hasPermission:(p:string[],key:string)=>p.includes(key)}));
import {accountRelatedTotals} from "@/lib/reports/related";
it("aggregates independent children once without multiplying payment and debt rows",async()=>{
 db.opps.mockResolvedValue([{id:"o",accountId:"a",amount:100}]);db.debts.mockResolvedValue([{id:"d1",currentBalance:50,opportunity:{accountId:"a"}},{id:"d2",currentBalance:70,opportunity:{accountId:"a"}}]);db.payments.mockResolvedValue([{id:"p1",amount:10,client:{opportunity:{accountId:"a"}}},{id:"p2",amount:20,client:{opportunity:{accountId:"a"}}}]);
 const result=await accountRelatedTotals(["a"],{userId:"u",isAdmin:true,permissions:[],ownerIds:[]});expect(result.get("a")).toMatchObject({opportunityCount:1,opportunityAmount:100,debtBalance:120,paymentAmount:30});
 expect(db.debts.mock.calls[0][0].where.AND).toContainEqual({allowedModel:"debt"});
});
it("keeps unauthorized related measures blank rather than exposing totals",async()=>{
 db.opps.mockResolvedValue([]);db.debts.mockResolvedValue([]);db.payments.mockResolvedValue([]);
 const result=await accountRelatedTotals(["a"],{userId:"u",isAdmin:false,permissions:["Account.View"],ownerIds:["u"]});expect(result.get("a")).toMatchObject({opportunityCount:null,debtBalance:null,paymentAmount:null});
});
