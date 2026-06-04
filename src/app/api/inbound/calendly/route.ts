/**
 * Calendly webhook → Lead + Event.
 * Replaces SF Flow: CreateLeadFromCalendlyEvent.
 *
 * Configure in Calendly: Settings → Integrations → Webhooks → add this URL.
 * Subscribe to `invitee.created` (and optionally `invitee.canceled`).
 *
 * Auth: Calendly signs requests with HMAC-SHA256 using the secret you set
 * when creating the subscription. Set CALENDLY_WEBHOOK_SECRET in env; if
 * unset, we accept any payload (dev / setup mode).
 *
 * Payload shape (Calendly v2):
 *   {
 *     event: "invitee.created" | "invitee.canceled",
 *     payload: {
 *       event_type: { name: "Discovery Call", ... },
 *       invitee:    { name, email, questions_and_answers: [{question, answer}], ... },
 *       scheduled_event: { start_time, end_time, location: { join_url }, ... },
 *       tracking:   { utm_source, utm_campaign, ... }
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { makeCtx, triggerCreate } from "@/lib/triggers/runner";
import type { Lead, Event } from "@/generated/prisma/client";

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
  if (!signature) return false;
  // Calendly header: "t=<timestamp>,v1=<hmac>"
  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("="))
  ) as Record<string, string>;
  if (!parts.t || !parts.v1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${body}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
}

function pickQA(qa: Array<{ question: string; answer: string }> | undefined, key: string): string | null {
  if (!qa) return null;
  const match = qa.find((q) => q.question?.toLowerCase().includes(key.toLowerCase()));
  return match?.answer ?? null;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("calendly-webhook-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: {
    event: string;
    payload: {
      event_type?: { name?: string };
      invitee?: {
        name?: string;
        email?: string;
        questions_and_answers?: { question: string; answer: string }[];
        timezone?: string;
      };
      scheduled_event?: {
        start_time?: string;
        end_time?: string;
        location?: { join_url?: string };
      };
      tracking?: {
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
      };
    };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, payload } = body;
  const invitee = payload?.invitee ?? {};
  const scheduled = payload?.scheduled_event ?? {};
  const tracking = payload?.tracking ?? {};

  // We only act on invitee.created — cancellations leave the lead but
  // close the related event
  if (event === "invitee.canceled") {
    const start = scheduled.start_time ? new Date(scheduled.start_time) : null;
    if (!invitee.email || !start) {
      return NextResponse.json({ ok: true, skipped: "missing-data" });
    }
    await prisma.event.updateMany({
      where: {
        startAt: start,
        // Match by lead's email (best-effort)
        lead: { email: invitee.email },
      },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true, action: "event-cancelled" });
  }

  if (event !== "invitee.created") {
    return NextResponse.json({ ok: true, skipped: `event:${event}` });
  }

  const name = invitee.name ?? "Calendly Invitee";
  const email = invitee.email ?? null;
  const phone =
    pickQA(invitee.questions_and_answers, "phone") ??
    pickQA(invitee.questions_and_answers, "mobile") ??
    "";
  const businessName =
    pickQA(invitee.questions_and_answers, "business") ??
    pickQA(invitee.questions_and_answers, "company") ??
    name;
  const debtAnswer = pickQA(invitee.questions_and_answers, "debt");
  const totalDebtEst = debtAnswer
    ? parseFloat(debtAnswer.replace(/[^0-9.]/g, "")) || null
    : null;
  const state = pickQA(invitee.questions_and_answers, "state");

  // Dedupe by email
  const existing = email
    ? await prisma.lead.findFirst({ where: { email, source: "Calendly" }, select: { id: true } })
    : null;

  const ctx = makeCtx(null);
  const lead =
    existing ??
    (await triggerCreate<Lead>("lead", {
      recordType: "WEB",
      businessName,
      contactName: name,
      phone,
      email,
      source: "Calendly",
      state: state && state.length === 2 ? state.toUpperCase() : state,
      totalDebtEst,
      utmSource: tracking.utm_source ?? null,
      utmMedium: tracking.utm_medium ?? null,
      utmCampaign: tracking.utm_campaign ?? null,
    }, ctx));

  // Create the calendar Event row
  const startAt = scheduled.start_time ? new Date(scheduled.start_time) : new Date();
  const endAt = scheduled.end_time ? new Date(scheduled.end_time) : new Date(startAt.getTime() + 30 * 60_000);
  const eventTypeName = payload?.event_type?.name ?? "Calendly Meeting";

  const evt = await triggerCreate<Event>("event", {
    subject: eventTypeName,
    leadId: lead.id,
    startAt,
    endAt,
    location: scheduled.location?.join_url ?? null,
    status: "SCHEDULED",
    type: "MEETING",
  }, ctx);

  return NextResponse.json({ ok: true, leadId: lead.id, eventId: evt.id });
}
