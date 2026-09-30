import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(_req:NextRequest,ctx:{params:Promise<{token:string}>}) {
  const {token}=await ctx.params;
  const e=await prisma.envelope.findUnique({where:{signingToken:token},include:{events:{where:{eventType:{in:["CREATED","SENT","VIEWED","EMAIL_VERIFIED","CONSENT_ACCEPTED","SIGNED","COMPLETED","EMAIL_FAILED"]}},orderBy:{createdAt:"asc"}}}});
  if(!e || e.status!=="COMPLETED") return NextResponse.json({error:"Not available"},{status:404});
  return NextResponse.json({envelopeId:e.id,documentName:e.documentName,signerEmail:e.signerEmail,completedAt:e.completedAt,events:e.events.map(({eventType,details,ipAddress,userAgent,createdAt})=>({eventType,details,ipAddress,userAgent,createdAt}))},{headers:{"Cache-Control":"no-store","Content-Disposition":`attachment; filename="${e.id}-evidence.json"`}});
}
