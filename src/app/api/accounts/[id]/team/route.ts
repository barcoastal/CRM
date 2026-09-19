import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthOrRespond } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { canAccessRecord,recordScope } from '@/lib/record-access';
import { hasSameOrigin } from '@/lib/request-origin';
import { hasPermission } from '@/lib/permissions';
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAuthOrRespond('Account.View');if('response'in auth)return auth.response;const{id}=await params;
 if(!await canAccessRecord('account',id))return NextResponse.json({error:'Not found'},{status:404});
 const canManage=hasPermission(auth.session.permissions,'Account.Edit')&&!!await prisma.account.findFirst({where:{id,AND:[await recordScope('account',false)]},select:{id:true}});
 const members=await prisma.accountTeamMember.findMany({where:{accountId:id},include:{user:{select:{id:true,name:true,email:true}}},orderBy:{role:'asc'}});
 return NextResponse.json({members,canManage});
}
const schema=z.object({userId:z.string().min(1),role:z.enum(['Closer','Customer Service Rep','Team Member'])});
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAuthOrRespond('Account.Edit');if('response'in auth)return auth.response;const{id}=await params;
 if(!hasSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 if(!await prisma.account.findFirst({where:{id,AND:[await recordScope('account',false)]},select:{id:true}}))return NextResponse.json({error:'Not found'},{status:404});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Choose a user and role'},{status:400});
 const user=await prisma.user.findFirst({where:{id:parsed.data.userId,isActive:true},select:{id:true}});if(!user)return NextResponse.json({error:'User not found'},{status:404});
 const member=await prisma.$transaction(async tx=>{const m=await tx.accountTeamMember.upsert({where:{accountId_userId_role:{accountId:id,...parsed.data}},create:{accountId:id,...parsed.data},update:{}});await tx.auditLog.create({data:{userId:auth.session.userId,entity:'AccountTeamMember',entityId:m.id,action:'CREATE',after:{accountId:id,...parsed.data}}});return m;});
 return NextResponse.json(member,{status:201});
}
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAuthOrRespond('Account.Edit');if('response'in auth)return auth.response;const{id}=await params;
 if(!hasSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 if(!await prisma.account.findFirst({where:{id,AND:[await recordScope('account',false)]},select:{id:true}}))return NextResponse.json({error:'Not found'},{status:404});
 const body=await req.json().catch(()=>({}));if(typeof body.memberId!=='string')return NextResponse.json({error:'Member required'},{status:400});
 const member=await prisma.accountTeamMember.findFirst({where:{id:body.memberId,accountId:id}});if(!member)return NextResponse.json({error:'Not found'},{status:404});
 if(member.source==='CLOSER_SYNC')return NextResponse.json({error:'This membership follows the assigned closer. Change the closer to remove it.'},{status:409});
 await prisma.$transaction(async tx=>{await tx.accountTeamMember.delete({where:{id:member.id}});await tx.auditLog.create({data:{userId:auth.session.userId,entity:'AccountTeamMember',entityId:member.id,action:'DELETE',before:{accountId:id,userId:member.userId,role:member.role}}});});
 return NextResponse.json({ok:true});
}
