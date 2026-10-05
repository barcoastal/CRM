import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
export const ADDENDUM_REASONS = ['Full Balance Creditor', 'Long Payment Term', 'Manual Assignment'] as const;
export function snapshot(json: string | null | undefined): Record<string, unknown> {
  try { const value=JSON.parse(json || '{}'); return value && typeof value==='object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function addendumReasons(input: { totalDebt: number | null; termMonths: number | null; fullBalance: boolean; manual: boolean }) {
  const {totalDebt,termMonths}=input;
  const threshold=totalDebt!==null && Number.isFinite(totalDebt) && totalDebt>=0 ? totalDebt<=50000 ? 6 : totalDebt<=100000 ? 10 : totalDebt<=200000 ? 12 : 16 : null;
  return ADDENDUM_REASONS.filter(reason=>reason==='Manual Assignment' ? input.manual : reason==='Full Balance Creditor' ? input.fullBalance : threshold!==null && termMonths!==null && Number.isFinite(termMonths) && termMonths>=threshold);
}
/** Run within the caller's transaction so the calculator and its eligibility agree. */
export async function refreshAddendum(tx: Prisma.TransactionClient, id: string, manual?: boolean) {
  await tx.$queryRaw`SELECT id FROM "Opportunity" WHERE id=${id} FOR UPDATE`;
  const opp=await tx.opportunity.findUnique({where:{id},include:{debts:{include:{creditor:{include:{account:true}}}}}});
  if(!opp) return null;
  const sf=snapshot(opp.sfDataJson);
  const calculation=await tx.opportunityPaymentCalculation.findFirst({where:{opportunityId:id},orderBy:{savedAt:'desc'}});
  const plan=calculation ? null : await tx.programPlan.findFirst({where:{opportunityId:id},orderBy:{createdAt:'desc'}});
  // Imported debts may retain only the Salesforce current-creditor reference.
  const refs=opp.debts.map(d=>snapshot(d.sfDataJson).Current_Creditor__c).filter((v):v is string=>typeof v==='string' && !!v);
  const accounts=refs.length ? await tx.account.findMany({where:{sfId:{in:refs}},select:{sfId:true,sfDataJson:true}}) : [];
  const names=opp.debts.filter(d=>!d.creditorId && !snapshot(d.sfDataJson).Current_Creditor__c).map(d=>d.creditorName);
  const named=names.length ? await tx.account.findMany({where:{name:{in:names}},select:{name:true,sfDataJson:true}}) : [];
  const fullBalance=opp.debts.some(d=>{
    const ref=snapshot(d.sfDataJson).Current_Creditor__c;
    const matches=named.filter(a=>a.name===d.creditorName);
    const account=d.creditor?.account ?? accounts.find(a=>a.sfId===ref) ?? (matches.length===1 ? matches[0] : null);
    return snapshot(account?.sfDataJson).Full_Balance_Creditor__c===true;
  });
  const oldReasons=String(sf.Addendum_Required_Reason__c ?? '').split(';').map(v=>v.trim());
  const reasons=addendumReasons({totalDebt:calculation?.totalDebt ?? plan?.totalEnrolledDebt ?? null,termMonths:calculation?.programFeePeriod ?? plan?.termMonths ?? null,fullBalance,manual:manual ?? oldReasons.includes('Manual Assignment')});
  // Imported opportunities can predate CRM calculator history. Keep their term
  // decision until a local calculation supplies the inputs for reevaluation.
  if (!calculation && !plan && oldReasons.includes('Long Payment Term')) {
    reasons.splice(fullBalance ? 1 : 0, 0, 'Long Payment Term');
  }
  const required=reasons.length>0, reason=reasons.join(';');
  if(opp.addendumRequired===required && sf.Addendum_Required__c===required && sf.Addendum_Required_Reason__c===reason) return opp;
  return tx.opportunity.update({where:{id},data:{addendumRequired:required,sfDataJson:JSON.stringify({...sf,Addendum_Required__c:required,Addendum_Required_Reason__c:reason})}});
}
export async function reevaluateAddendum(id: string | null | undefined, manual?: boolean) {
  if(!id) return null;
  return prisma.$transaction(tx=>refreshAddendum(tx,id,manual));
}
