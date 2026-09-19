import {NextRequest,NextResponse} from 'next/server';
import {requireAuthOrRespond} from '@/lib/api-auth';
import {canAccessRecord} from '@/lib/record-access';
import {prisma} from '@/lib/prisma';
import {hasSameOrigin} from '@/lib/request-origin';
import {revalidatePath} from 'next/cache';
export async function POST(req:NextRequest,{params}:{params:Promise<{entity:string;id:string}>}){
 const {entity,id}=await params;if(entity!=='account'&&entity!=='opportunity')return NextResponse.json({error:'Not found'},{status:404});
 const auth=await requireAuthOrRespond(entity==='account'?'Account.View':'Opportunity.View');if('response'in auth)return auth.response;
 if(!hasSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 if(!await canAccessRecord(entity,id))return NextResponse.json({error:'Not found'},{status:404});
 await prisma.recordViewHistory.upsert({where:{userId_entity_recordId:{userId:auth.session.userId,entity,recordId:id}},create:{userId:auth.session.userId,entity,recordId:id},update:{viewedAt:new Date()}});
 revalidatePath(entity==='account'?'/accounts':'/opportunities');return NextResponse.json({ok:true});
}
