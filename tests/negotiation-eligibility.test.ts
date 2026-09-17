import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{opportunity:{findFirst:m.find}}}));
import { negotiationEligibilityWhere } from '@/lib/negotiation-eligibility';
import { isNegotiationEligible } from '@/lib/negotiation-access';
const active={clientStatus:'Active',isActive:true};
function matches(stage:string,account:{clientStatus:string;isActive:boolean}|null) {
 const query=negotiationEligibilityWhere();
 const allowed=(query.stage as {in:string[]}).in;
 const filter=(query.account as {is:{clientStatus:string;isActive:boolean}}).is;
 return allowed.includes(stage) && !!account && account.clientStatus===filter.clientStatus && account.isActive===filter.isActive;
}
beforeEach(()=>vi.resetAllMocks());
it.each(['Closed Won First Payment Pending','Closed Won - First Payment Completed'])('allows %s only with an active account',stage=>{expect(matches(stage,active)).toBe(true);});
it.each(['Working Opportunity','Closed Lost','Archived - Finalized','Closed Won - Fake','Negotiating',''])('excludes non-won stage %s even when account is active',stage=>{expect(matches(stage,active)).toBe(false);});
it.each(['First Payment pending','On Hold','Pending Cancellation','Cancelled','Suspended','Graduated','Closed Duplicate','Inactive'])('excludes account status %s even when opportunity is won',clientStatus=>{expect(matches('Closed Won - First Payment Completed',{clientStatus,isActive:true})).toBe(false);});
it('excludes missing and soft-deleted accounts',()=>{expect(matches('Closed Won - First Payment Completed',null)).toBe(false);expect(matches('Closed Won - First Payment Completed',{...active,isActive:false})).toBe(false);});
it('rechecks current eligibility for each action instead of caching it',async()=>{m.find.mockResolvedValueOnce({id:'opp'}).mockResolvedValueOnce(null);expect(await isNegotiationEligible('opp')).toBe(true);expect(await isNegotiationEligible('opp')).toBe(false);expect(m.find).toHaveBeenCalledWith({where:{id:'opp',stage:{in:['Closed Won First Payment Pending','Closed Won - First Payment Completed']},account:{is:{clientStatus:'Active',isActive:true}}},select:{id:true}});});
