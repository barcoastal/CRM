/**
 * Inbound ad-click-id matcher.
 * Port of SF UpdateAdClickId (docs/sf-export/sfdx-raw/classes/UpdateAdClickId.cls)
 *
 * Called by the call-tracking provider (e.g. CallRail, RedTrack) when a
 * tracked phone number is dialed. We match the most recent Lead with
 * matching phone + matching lead source (derived from the dialed number)
 * and stamp the adClickId so attribution flows downstream.
 *
 *   GET /api/inbound/ad-click-id?fromPhoneNumber=+15551234567
 *                              &toPhoneNumber=+18005551111
 *                              &adClickId=abc123
 *
 * In SF, the dialed number → lead source mapping lived in
 * InboundPhoneLeadSourceMdt (custom metadata). We rebuild that as the
 * INBOUND_PHONE_LEAD_SOURCE_MAP env var: JSON map of "<digits>"→"<source>".
 * If you set `phoneNumberX_source` env pairs we'll pick up those too.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
}

function getInboundPhoneSourceMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const json = process.env.INBOUND_PHONE_LEAD_SOURCE_MAP;
  if (json) {
    try {
      Object.assign(map, JSON.parse(json));
    } catch {
      /* ignore */
    }
  }
  return map;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fromPhone = url.searchParams.get("fromPhoneNumber");
  const toPhone = url.searchParams.get("toPhoneNumber");
  const adClickId = url.searchParams.get("adClickId");

  if (!fromPhone || !toPhone || !adClickId) {
    return NextResponse.json(
      { isSuccess: false, message: `Required fields missing — params: ${url.search}` },
      { status: 400 }
    );
  }

  const toDigits = formatPhone(toPhone);
  const sources = getInboundPhoneSourceMap();
  const leadSource = sources[toDigits] ?? sources[`+1${toDigits}`] ?? null;

  if (!leadSource) {
    return NextResponse.json({
      isSuccess: true,
      message: `No Inbound Lead Source mapping found for the provided toPhoneNumber.`,
      toPhone: toDigits,
    });
  }

  const fromDigits = formatPhone(fromPhone);
  const matchingLead = await prisma.lead.findFirst({
    where: {
      phone: { contains: fromDigits },
      source: leadSource,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!matchingLead) {
    return NextResponse.json({
      isSuccess: true,
      message: "No Matching Lead found",
      fromPhone: fromDigits,
      leadSource,
    });
  }

  await prisma.lead.update({
    where: { id: matchingLead.id },
    data: { adClickId },
  });

  return NextResponse.json({
    isSuccess: true,
    message: "Lead updated successfully",
    leadId: matchingLead.id,
  });
}
