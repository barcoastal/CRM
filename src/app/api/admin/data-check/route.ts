import { leadPaymentPopulated } from "@/lib/lead-payment-health";
import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthOrRespond } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { querySourceRecords } from '@/lib/sf-sync/bulk-export';
import { LEAD_PARITY_FIELDS,missingSourceFields,sourceValueMatches } from '@/lib/sf-sync/lead-fields';
import { hasSameOrigin } from '@/lib/request-origin';
const schema=z.object({ids:z.array(z.string().regex(/^[a-zA-Z0-9]{15,18}$/)).min(1).max(20),apply:z.boolean().default(false)});
export async function POST(req:NextRequest){
 const auth=await requireAuthOrRespond();if('response'in auth)return auth.response;
 if(!['ADMIN','SUPER_ADMIN'].includes(auth.session.role))return NextResponse.json({error:'Administrator access required'},{status:403});
 if(!hasSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Enter up to 20 valid source lead IDs'},{status:400});
 try{
  const source=await querySourceRecords(`SELECT ${LEAD_PARITY_FIELDS.join(',')} FROM Lead WHERE Id IN (${parsed.data.ids.map(id=>`'${id}'`).join(',')}) LIMIT 20`);
  const results=[];
  for(const record of source){
   record.Is_Payment_Amount_Populated__c=leadPaymentPopulated(record);
   const lead=await prisma.lead.findUnique({where:{sfId:String(record.Id)},select:{id:true,sfId:true,sfDataJson:true,status:true,source:true,assignedToId:true,assignedTo:{select:{sfId:true}}}});
   if(!lead){results.push({id:record.Id,status:'Not imported',missing:[],differences:[]});continue;}
   let current:Record<string,unknown>={};try{current=JSON.parse(lead.sfDataJson||'{}');}catch{}
   const missing=missingSourceFields(current,record);
   const differences=Object.keys(record).filter(k=>k!=='attributes'&&k in current&&!sourceValueMatches(current[k],record[k]));
   if(lead.status!==record.Status)differences.push('Lead status');if(lead.source!==record.LeadSource)differences.push('Lead source');if(lead.assignedTo?.sfId!==record.OwnerId)differences.push('Owner mapping');
   let applied=false;
   if(parsed.data.apply&&missing.length){
    const addition=Object.fromEntries(missing.map(k=>[k,record[k]]));
    await prisma.$transaction(async tx=>{
     const updated=await tx.lead.updateMany({where:{id:lead.id,sfDataJson:lead.sfDataJson},data:{sfDataJson:JSON.stringify({...current,...addition})}});
     if(updated.count!==1)throw Error('Record changed during comparison. Run the check again.');
     await tx.auditLog.create({data:{userId:auth.session.userId,entity:'Lead',entityId:lead.id,action:'UPDATE',after:{reconciledFields:missing}}});
    });applied=true;
   }
   results.push({id:record.Id,crmId:lead.id,status:applied?'Missing fields repaired':missing.length||differences.length?'Differences found':'Matched',missing,differences});
  }
  for(const id of parsed.data.ids)if(!source.some(r=>String(r.Id).slice(0,15)===id.slice(0,15)))results.push({id,status:'Not found in source',missing:[],differences:[]});
  return NextResponse.json({results});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Comparison failed'},{status:502});}
}
