/**
 * Receive browser-captured call audio, transcribe with Deepgram, store it.
 *
 * POST /api/dialer/transcribe?leadId=&phone=&customer=&direction=&durationSec=
 *   body: raw audio bytes (audio/webm from MediaRecorder)
 *   → { id, transcript, summary, ... }
 *
 * GET  /api/dialer/transcribe?leadId=         → transcripts for a lead
 * GET  /api/dialer/transcribe?recent=1        → recent transcripts (floor)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deepgramConfigured, transcribeAudio } from "@/lib/deepgram";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!deepgramConfigured()) {
    return NextResponse.json({ error: "Transcription not configured (DEEPGRAM_API_KEY missing)" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const leadId = sp.get("leadId") || null;
  const phone = sp.get("phone") || null;
  const customer = sp.get("customer") || null;
  const direction = sp.get("direction") || null;
  const durationSec = sp.get("durationSec") ? Number(sp.get("durationSec")) : null;
  const five9Username = sp.get("five9Username") || null;
  const contentType = req.headers.get("content-type") || "audio/webm";

  const audio = await req.arrayBuffer();
  if (!audio || audio.byteLength < 2000) {
    return NextResponse.json({ error: "Audio too short or empty" }, { status: 400 });
  }

  try {
    const result = await transcribeAudio(audio, contentType);
    const row = await prisma.callTranscript.create({
      data: {
        leadId,
        agentUserId: session.user.id,
        five9Username,
        phone,
        customer,
        direction,
        durationSec: durationSec && !Number.isNaN(durationSec) ? Math.round(durationSec) : null,
        status: "DONE",
        transcript: result.transcript,
        summary: result.summary,
        raw: result.raw as object,
      },
      select: { id: true, transcript: true, summary: true, durationSec: true, createdAt: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "transcription failed";
    await prisma.callTranscript.create({
      data: { leadId, agentUserId: session.user.id, five9Username, phone, customer, direction, status: "FAILED", error: msg },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const leadId = sp.get("leadId");
  const where = leadId ? { leadId } : {};
  const rows = await prisma.callTranscript.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: leadId ? 10 : 30,
    select: {
      id: true, leadId: true, five9Username: true, phone: true, customer: true,
      direction: true, durationSec: true, status: true, transcript: true, summary: true, createdAt: true,
    },
  });
  return NextResponse.json({ transcripts: rows });
}
