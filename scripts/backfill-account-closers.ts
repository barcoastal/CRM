/** Populate existing closer teams. Dry-run by default; --apply makes changes.
 * Uses current stored assignments and active users with matching stable IDs.
 * Preserves all manual memberships. No source system writes.
 */
import { prisma } from '../src/lib/prisma';
import { importedCloserId } from '../src/lib/account-team';
async function main() {
 const apply=process.argv.includes('--apply');
 const users=await prisma.user.findMany({where:{isActive:true},select:{id:true,sfId:true}});
 const userIds=new Map(users.flatMap(user=>[[user.id,user.id],...(user.sfId?[[user.sfId,user.id]]:[])] as [string,string][]));
 let cursor:string|undefined;let checked=0;let changed=0;let unmapped=0;
 while(true){
  const accounts=await prisma.account.findMany({where:{...(cursor?{id:{gt:cursor}}:{})},orderBy:{id:'asc'},take:250,select:{id:true,sfDataJson:true,teamMembers:{select:{userId:true,role:true,source:true}}}});
  if(!accounts.length)break;
  const desired: {accountId:string;userId:string;role:'Closer';source:'CLOSER_SYNC'}[]=[];
  for(const account of accounts){
   checked++;const closer=importedCloserId(account.sfDataJson);const userId=closer?userIds.get(closer):undefined;
   if(closer&&!userId)unmapped++;
   const stale=account.teamMembers.some(m=>m.source==='CLOSER_SYNC'&&m.userId!==userId);
   const missing=!!userId&&!account.teamMembers.some(m=>m.userId===userId&&m.role==='Closer');
   if(stale||missing)changed++;
   if(userId)desired.push({accountId:account.id,userId,role:'Closer',source:'CLOSER_SYNC'});
  }
  if(apply){
   const ids=accounts.map(account=>account.id);
   await prisma.$transaction(async tx=>{
    await tx.accountTeamMember.deleteMany({where:{accountId:{in:ids},source:'CLOSER_SYNC'}});
    if(desired.length)await tx.accountTeamMember.createMany({data:desired,skipDuplicates:true});
   });
  }
  cursor=accounts.at(-1)!.id;
 }
 console.log(JSON.stringify({mode:apply?'applied':'dry-run',checked,accountsWithChanges:changed,unmappedClosers:unmapped}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
