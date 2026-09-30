import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendESignEmail } from "@/lib/esign/send-email";
import { isSignable, signingFieldsHash, mac, safeEqual, signProof, readProof, proofCookie, verifiedPreparedPdf } from "@/lib/esign/evidence";

type Context = { params: Promise<{ token: string }> };
export async function GET(req: NextRequest, ctx: Context) {
  const { token } = await ctx.params;
  const e = await prisma.envelope.findUnique({where:{signingToken:token}});
  if (!e || !isSignable(e)) return NextResponse.json({verified:false}, {status:404});
  const proof = readProof(req.cookies.get(proofCookie(e.id))?.value, e);
  return NextResponse.json({verified:!!proof}, {headers:{"Cache-Control":"no-store"}});
}
export async function POST(req: NextRequest, ctx: Context) {
  const { token } = await ctx.params;
  const body = await req.json().catch(()=>null);
  if (!body || !["send", "verify"].includes(body.action)) return NextResponse.json({error:"Invalid request"},{status:400});
  const e = await prisma.envelope.findUnique({where:{signingToken:token}});
  if (!e || !isSignable(e)) return NextResponse.json({error:"This signing link is unavailable or expired."},{status:410});
  if (!e.preparedPdfPath) return NextResponse.json({error:"Document unavailable. Contact the sender."},{status:409});
  let documentHash: string;
  try { documentHash = (await verifiedPreparedPdf(e.preparedPdfPath)).hash; }
  catch { return NextResponse.json({error:"This document has no verified snapshot. Ask the sender to send a new envelope."},{status:409}); }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = req.headers.get("user-agent") ?? "";
  const code = String(randomInt(100000,1000000));
  const nonce = randomUUID();
  const now = new Date();
  // Serialize challenge creation and attempts across instances; enforce a shared rate limit.
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${e.id}))`;
    const events = await tx.envelopeEvent.findMany({where:{envelopeId:e.id,eventType:{in:["VERIFY_CHALLENGE","VERIFY_ATTEMPT"]},createdAt:{gte:new Date(now.getTime()-3600000)}},orderBy:{createdAt:"desc"}});
    const challenges = events.filter(x=>x.eventType==="VERIFY_CHALLENGE");
    const latest = challenges[0];
    if (body.action === "send") {
      if (challenges.length >= 5 || (latest && now.getTime()-latest.createdAt.getTime()<60000)) return {error:"Please wait before requesting another code.",status:429};
      await tx.envelopeEvent.create({data:{envelopeId:e.id,eventType:"VERIFY_CHALLENGE",details:JSON.stringify({nonce,digest:mac(`${e.id}:${nonce}:${code}`),documentHash}),ipAddress:ip,userAgent:ua}});
      return {send:true};
    }
    if (!latest || now.getTime()-latest.createdAt.getTime()>600000) return {error:"Code expired. Request a new code.",status:400};
    const challenge = JSON.parse(latest.details!);
    const attempts = events.filter(x=>x.eventType==="VERIFY_ATTEMPT" && x.createdAt >= latest.createdAt);
    if (attempts.length >= 5) return {error:"Too many attempts. Request a new code.",status:429};
    await tx.envelopeEvent.create({data:{envelopeId:e.id,eventType:"VERIFY_ATTEMPT",ipAddress:ip,userAgent:ua}});
    if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code) || !safeEqual(mac(`${e.id}:${challenge.nonce}:${body.code}`),challenge.digest) || challenge.documentHash!==documentHash) return {error:"Incorrect code.",status:400};
    const used = await tx.envelopeEvent.findFirst({where:{envelopeId:e.id,eventType:"EMAIL_VERIFIED",details:{contains:latest.id}}});
    if (used) return {error:"Code already used. Request a new code.",status:400};
    const event = await tx.envelopeEvent.create({data:{envelopeId:e.id,eventType:"EMAIL_VERIFIED",details:JSON.stringify({challengeId:latest.id,email:e.signerEmail,documentHash,method:"email one-time code"}),ipAddress:ip,userAgent:ua}});
    return {eventId:event.id};
  });
  if (result.error) return NextResponse.json({error:result.error},{status:result.status});
  if (result.send) {
    const mail = await sendESignEmail({from:process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>",to:e.signerEmail,subject:"Your Coastal signing verification code",html:`<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. Do not share this code. If you did not request it, ignore this email.</p>`});
    return NextResponse.json(mail.ok?{sent:true}:{error:"Code could not be delivered. Contact the sender."},{status:mail.ok?200:502});
  }
  const response = NextResponse.json({verified:true});
  response.cookies.set(proofCookie(e.id),signProof({envelopeId:e.id,email:e.signerEmail,documentHash,fieldsHash:signingFieldsHash(e),verifiedAt:now.toISOString(),expires:now.getTime()+1800000,eventId:result.eventId!}),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:`/api/esign/envelopes/by-token/${token}`,maxAge:1800});
  return response;
}
