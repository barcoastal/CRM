import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthOrRespond } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { hasSameOrigin } from '@/lib/request-origin';
const row=z.object({contactName:z.string().trim().min(1).max(255),businessName:z.string().trim().min(1).max(255),phone:z.string().trim().min(7).max(40),email:z.union([z.string().email(),z.literal('')]).optional(),source:z.string().max(100).optional()});
export async function POST(req:NextRequest){
 const auth=await requireAuthOrRespond('Lead.Create');if('response'in auth)return auth.response;
 if(!hasSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const parsed=z.object({rows:z.array(row).min(1).max(200)}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Invalid import rows',details:parsed.error.flatten()},{status:400});
 const result=await prisma.$transaction(async tx=>{
  let created=0;let skipped=0;
  for(const record of parsed.data.rows){
   const existing=await tx.lead.findFirst({where:{phone:record.phone,businessName:record.businessName},select:{id:true}});
   if(existing){skipped++;continue;}
   const lead=await tx.lead.create({data:{...record,email:record.email||null,source:record.source||'Other',status:'New',assignedToId:auth.session.userId}});
   await tx.auditLog.create({data:{userId:auth.session.userId,entity:'Lead',entityId:lead.id,action:'CREATE',after:{source:'CSV import'}}});created++;
  }
  return {created,skipped};
 },{timeout:60000});
 return NextResponse.json(result,{status:201});
}
