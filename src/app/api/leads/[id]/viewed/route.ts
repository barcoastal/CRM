import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessRecord } from '@/lib/record-access';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: Promise<{id: string}> }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({error:'Invalid origin'}, {status:403});
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const {id} = await params;
  if (!await canAccessRecord('lead',id)) return NextResponse.json({error:'Not found'}, {status:404});
  await prisma.leadViewHistory.upsert({
    where:{userId_leadId:{userId:session.user.id,leadId:id}},
    create:{userId:session.user.id,leadId:id}, update:{viewedAt:new Date()},
  });
  return new NextResponse(null,{status:204});
}
