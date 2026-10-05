import {expect,it,vi} from 'vitest';
vi.mock('@/lib/prisma',()=>({prisma:{}}));
import {addendumReasons} from '@/lib/contracts/addendum';
const run=(totalDebt:number|null,termMonths:number|null,fullBalance=false,manual=false)=>addendumReasons({totalDebt,termMonths,fullBalance,manual});
it.each([[0,6],[50000,6],[50000.01,10],[100000,10],[100000.01,12],[200000,12],[200000.01,16]])('applies the debt boundary %s at %s months',(debt,term)=>{expect(run(debt,term-1)).toEqual([]);expect(run(debt,term)).toEqual(['Long Payment Term']);});
it('retains independent reasons and removes only the inapplicable ones',()=>{expect(run(150000,12,true,true)).toEqual(['Full Balance Creditor','Long Payment Term','Manual Assignment']);expect(run(150000,6,false,true)).toEqual(['Manual Assignment']);expect(run(150000,6)).toEqual([]);expect(run(null,null,true)).toEqual(['Full Balance Creditor']);});
it('does not create a term reason from missing or invalid numbers',()=>{expect(run(null,12)).toEqual([]);expect(run(10000,null)).toEqual([]);expect(run(-1,20)).toEqual([]);expect(run(NaN,20)).toEqual([]);});
import {refreshAddendum} from '@/lib/contracts/addendum';
it('uses current creditor and saved calculation, retaining manual assignment',async()=>{
 const update=vi.fn().mockImplementation(({data})=>Promise.resolve(data));
 const tx={$queryRaw:vi.fn(),opportunity:{findUnique:vi.fn().mockResolvedValue({id:'o',addendumRequired:true,sfDataJson:JSON.stringify({Unrelated:'keep',Addendum_Required_Reason__c:'Full Balance Creditor;Manual Assignment'}),debts:[{creditorId:'c',creditorName:'Creditor',sfDataJson:null,creditor:{account:{sfDataJson:'{"Full_Balance_Creditor__c":false}'}}}]}),update},opportunityPaymentCalculation:{findFirst:vi.fn().mockResolvedValue({totalDebt:150000,programFeePeriod:12})}};
 await refreshAddendum(tx as never,'o');
 const data=update.mock.calls[0][0].data;expect(data.addendumRequired).toBe(true);expect(JSON.parse(data.sfDataJson)).toMatchObject({Unrelated:'keep',Addendum_Required_Reason__c:'Long Payment Term;Manual Assignment'});
});
it.each([false,true])('removing the last automatic reason preserves manual=%s',async manual=>{
 const update=vi.fn().mockImplementation(({data})=>Promise.resolve(data));
 const tx={$queryRaw:vi.fn(),opportunity:{findUnique:vi.fn().mockResolvedValue({id:'o',addendumRequired:true,sfDataJson:JSON.stringify({Addendum_Required_Reason__c:manual?'Full Balance Creditor;Manual Assignment':'Full Balance Creditor'}),debts:[]}),update},opportunityPaymentCalculation:{findFirst:vi.fn().mockResolvedValue({totalDebt:150000,programFeePeriod:6})}};
 await refreshAddendum(tx as never,'o');
 expect(update.mock.calls[0][0].data.addendumRequired).toBe(manual);
 expect(JSON.parse(update.mock.calls[0][0].data.sfDataJson).Addendum_Required_Reason__c).toBe(manual?'Manual Assignment':'');
});
