import { prisma } from "@/lib/prisma";
import { isSuppressed } from "@/lib/dnc";

const STATE_TIME_ZONES: Record<string, string[]> = {
  AL: ["America/Chicago"], AK: ["America/Anchorage"], AZ: ["America/Phoenix"], AR: ["America/Chicago"],
  CA: ["America/Los_Angeles"], CO: ["America/Denver"], CT: ["America/New_York"], DE: ["America/New_York"],
  FL: ["America/New_York", "America/Chicago"], GA: ["America/New_York"], HI: ["Pacific/Honolulu"], ID: ["America/Boise", "America/Los_Angeles"],
  IL: ["America/Chicago"], IN: ["America/Indiana/Indianapolis", "America/Chicago"], IA: ["America/Chicago"], KS: ["America/Chicago", "America/Denver"],
  KY: ["America/New_York", "America/Chicago"], LA: ["America/Chicago"], ME: ["America/New_York"], MD: ["America/New_York"],
  MA: ["America/New_York"], MI: ["America/Detroit", "America/Chicago"], MN: ["America/Chicago"], MS: ["America/Chicago"],
  MO: ["America/Chicago"], MT: ["America/Denver"], NE: ["America/Chicago", "America/Denver"], NV: ["America/Los_Angeles", "America/Denver"],
  NH: ["America/New_York"], NJ: ["America/New_York"], NM: ["America/Denver"], NY: ["America/New_York"],
  NC: ["America/New_York"], ND: ["America/Chicago", "America/Denver"], OH: ["America/New_York"], OK: ["America/Chicago"],
  OR: ["America/Los_Angeles", "America/Boise"], PA: ["America/New_York"], RI: ["America/New_York"], SC: ["America/New_York"],
  SD: ["America/Chicago", "America/Denver"], TN: ["America/New_York", "America/Chicago"], TX: ["America/Chicago", "America/Denver"], UT: ["America/Denver"],
  VT: ["America/New_York"], VA: ["America/New_York"], WA: ["America/Los_Angeles"], WV: ["America/New_York"],
  WI: ["America/Chicago"], WY: ["America/Denver"], DC: ["America/New_York"],
};

function minutesInZone(date: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function parseTime(value: string | null, fallback: string): number {
  const match = (value ?? fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid campaign calling time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isWithinCallingWindow(args: {
  state: string | null;
  campaignTimezone: string;
  startTime: string | null;
  endTime: string | null;
  now?: Date;
}): boolean {
  const zones = STATE_TIME_ZONES[(args.state ?? "").toUpperCase()] ?? [args.campaignTimezone];
  const start = Math.max(parseTime(args.startTime, "08:00"), 8 * 60);
  const end = Math.min(parseTime(args.endTime, "20:00"), 21 * 60);
  const now = args.now ?? new Date();
  // For multi-zone states, only dial when every possible zone is allowed.
  return zones.every((zone) => {
    const local = minutesInZone(now, zone);
    return local >= start && local < end;
  });
}

export async function assertAiCallAllowed(lead: {
  id: string; phone: string; state: string | null; aiCallConsent: boolean;
  aiCallConsentAt: Date | null; aiCallConsentSource: string | null; aiCallConsentText: string | null;
}, campaign: { timezone: string; startTime: string | null; endTime: string | null }) {
  if (!lead.aiCallConsent || !lead.aiCallConsentAt || !lead.aiCallConsentSource || !lead.aiCallConsentText) {
    throw new Error("AI call blocked: verifiable automated-call consent is missing");
  }
  if (await isSuppressed(lead.phone)) throw new Error("AI call blocked: number is on the suppression list");
  if (!isWithinCallingWindow({
    state: lead.state, campaignTimezone: campaign.timezone,
    startTime: campaign.startTime, endTime: campaign.endTime,
  })) throw new Error("AI call blocked: outside the lead's permitted local calling window");
  const leadStillExists = await prisma.lead.count({ where: { id: lead.id, status: { not: "DNC" } } });
  if (!leadStillExists) throw new Error("AI call blocked: lead is marked DNC or no longer exists");
}
