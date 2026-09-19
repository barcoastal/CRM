import type { TriggerCtx } from './triggers/types';
export function importedCloserId(snapshot:string|null):string|null {
  if(!snapshot)return null;
  try{const value=JSON.parse(snapshot).Closer__c;return typeof value==='string'&&value.trim()?value.trim():null;}catch{return null;}
}
/** Match by stable user identifiers only; never grant access using a name match. */
export async function syncAccountCloser(db:TriggerCtx['prisma'],account:{id:string;sfDataJson:string|null}) {
  const id=importedCloserId(account.sfDataJson);
  const user=id?await db.user.findFirst({where:{isActive:true,OR:[{id},{sfId:id}]},select:{id:true}}):null;
  await db.accountTeamMember.deleteMany({where:{accountId:account.id,source:'CLOSER_SYNC',...(user?{userId:{not:user.id}}:{})}});
  if(user)await db.accountTeamMember.upsert({where:{accountId_userId_role:{accountId:account.id,userId:user.id,role:'Closer'}},create:{accountId:account.id,userId:user.id,role:'Closer',source:'CLOSER_SYNC'},update:{}});
}
