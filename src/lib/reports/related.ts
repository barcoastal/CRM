import type { Prisma } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { analyticsScope, type AnalyticsAccess } from "@/lib/analytics-access";
import { hasPermission } from "@/lib/permissions";
type Totals = { opportunityCount:number|null; opportunityAmount:number|null; debtBalance:number|null; paymentAmount:number|null; _scopeHash:string };
/** Independent scoped aggregates avoid debt × payment multiplication. */
export async function accountRelatedTotals(ids:string[],access:AnalyticsAccess,db:Prisma.TransactionClient=prisma):Promise<Map<string,Totals>> {
  const can=(permission:string)=>access.isAdmin||hasPermission(access.permissions,permission);
  const result=new Map(ids.map(id=>[id,{opportunityCount:can("Opportunity.View")?0:null,opportunityAmount:can("Opportunity.View")?0:null,debtBalance:can("Debt.View")?0:null,paymentAmount:can("Payment.View")?0:null,_scopeHash:""}]));
  const hashes=new Map(ids.map(id=>[id,createHash("sha256")]));
  const [opps,debts,payments]=await Promise.all([
    db.opportunity.findMany({where:{AND:[analyticsScope(access,"opportunity"),{accountId:{in:ids}}]},select:{id:true,accountId:true,amount:true},orderBy:{id:"asc"}}),
    db.debt.findMany({where:{AND:[analyticsScope(access,"debt"),{OR:[{opportunity:{accountId:{in:ids}}},{client:{opportunity:{accountId:{in:ids}}}}]}]},select:{id:true,currentBalance:true,opportunity:{select:{accountId:true}},client:{select:{opportunity:{select:{accountId:true}}}}},orderBy:{id:"asc"}}),
    db.payment.findMany({where:{AND:[analyticsScope(access,"payment"),{status:"COMPLETED",client:{opportunity:{accountId:{in:ids}}}}]},select:{id:true,amount:true,client:{select:{opportunity:{select:{accountId:true}}}}},orderBy:{id:"asc"}}),
  ]);
  for(const row of opps){const id=row.accountId??"",t=result.get(id);if(t&&t.opportunityCount!==null&&t.opportunityAmount!==null){t.opportunityCount++;t.opportunityAmount+=row.amount??0;hashes.get(id)?.update(`opp:${row.id};`);}}
  for(const row of debts){const id=row.opportunity?.accountId??row.client?.opportunity?.accountId??"",t=result.get(id);if(t&&t.debtBalance!==null){t.debtBalance+=row.currentBalance;hashes.get(id)?.update(`debt:${row.id};`);}}
  for(const row of payments){const id=row.client.opportunity?.accountId??"",t=result.get(id);if(t&&t.paymentAmount!==null){t.paymentAmount+=row.amount;hashes.get(id)?.update(`payment:${row.id};`);}}
  for(const [id,t] of result)t._scopeHash=hashes.get(id)!.digest("hex");
  return result;
}
