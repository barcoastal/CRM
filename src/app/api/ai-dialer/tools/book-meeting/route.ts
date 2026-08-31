import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAiToolSecret } from "@/lib/ai-dialer/tool-auth";
import { createGoogleCalendarEvent, isGoogleCalendarFree } from "@/lib/google-calendar/client";

const schema = z.object({
  callId: z.string().min(1), leadId: z.string().min(1), startAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(120).default(30),
});

export async function POST(request: NextRequest) {
  if (!verifyAiToolSecret(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking request", details: parsed.error.flatten() }, { status: 400 });
  const aiCall = await prisma.aiCall.findFirst({
    where: { retellCallId: parsed.data.callId, leadId: parsed.data.leadId }, include: { lead: true, campaign: true },
  });
  if (!aiCall) return NextResponse.json({ error: "Call and lead do not match" }, { status: 404 });
  if (aiCall.meetingAt) return NextResponse.json({ booked: true, startAt: aiCall.meetingAt, duplicate: true });
  const start = new Date(parsed.data.startAt);
  const duration = aiCall.campaign?.meetingDurationMin ?? parsed.data.durationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);
  if (start.getTime() < Date.now() || !(await isGoogleCalendarFree(start, end))) {
    return NextResponse.json({ booked: false, error: "That time is unavailable" }, { status: 409 });
  }
  const google = await createGoogleCalendarEvent({
    summary: `Qualified lead: ${aiCall.lead.businessName}`,
    description: `Booked by AI qualifier. Contact: ${aiCall.lead.contactName}\nPhone: ${aiCall.lead.phone}\nCRM lead: ${aiCall.lead.id}`,
    start, end, attendeeEmail: aiCall.lead.email,
  });
  const event = await prisma.event.create({ data: {
    subject: `Qualified lead meeting — ${aiCall.lead.businessName}`,
    description: `Google event ${google.id}; booked by Retell call ${aiCall.retellCallId}`,
    location: google.meetLink ?? google.htmlLink, status: "SCHEDULED",
    startAt: start, endAt: end, leadId: aiCall.leadId,
  } });
  await prisma.$transaction([
    prisma.aiCall.update({ where: { id: aiCall.id }, data: { meetingAt: start, outcome: "MEETING_BOOKED" } }),
    prisma.lead.update({ where: { id: aiCall.leadId }, data: { status: "QUALIFIED", nextFollowUpAt: start } }),
  ]);
  return NextResponse.json({ booked: true, startAt: start, endAt: end, eventId: event.id, googleEventId: google.id, meetingUrl: google.meetLink });
}
