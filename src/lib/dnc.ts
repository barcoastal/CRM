/**
 * DNC / Suppression List helpers. Normalizes phone numbers consistently
 * across the app and exposes the dialer-side DNC check.
 *
 * Phone normalization rule:
 *   - strip all non-digits
 *   - drop leading "1" if length is 11 (US country code)
 *   - keep last 10 digits as the canonical match key
 */

import { prisma } from "@/lib/prisma";

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("1") && digits.length === 11) return digits.slice(1);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function isSuppressed(phone: string): Promise<boolean> {
  const key = normalizePhone(phone);
  if (!key) return false;
  const entry = await prisma.suppressionEntry.findUnique({
    where: { phone: key },
    select: { id: true, expiresAt: true },
  });
  if (!entry) return false;
  if (entry.expiresAt && entry.expiresAt < new Date()) return false;
  return true;
}

export async function addSuppression(args: {
  phone: string;
  reason?: string;
  source?: string;
  leadId?: string | null;
  notes?: string | null;
  addedById?: string | null;
  expiresAt?: Date | null;
}): Promise<{ phone: string; alreadyOnList: boolean }> {
  const key = normalizePhone(args.phone);
  if (!key) throw new Error("Invalid phone number");
  const existing = await prisma.suppressionEntry.findUnique({ where: { phone: key } });
  if (existing) return { phone: key, alreadyOnList: true };

  await prisma.suppressionEntry.create({
    data: {
      phone: key,
      reason: args.reason ?? "Manual",
      source: args.source ?? null,
      leadId: args.leadId ?? null,
      notes: args.notes ?? null,
      addedById: args.addedById ?? null,
      expiresAt: args.expiresAt ?? null,
    },
  });
  return { phone: key, alreadyOnList: false };
}

export async function removeSuppression(phone: string): Promise<boolean> {
  const key = normalizePhone(phone);
  if (!key) return false;
  const res = await prisma.suppressionEntry.deleteMany({ where: { phone: key } });
  return res.count > 0;
}
