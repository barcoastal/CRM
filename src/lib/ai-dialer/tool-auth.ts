import crypto from "node:crypto";

export function verifyAiToolSecret(header: string | null): boolean {
  const expected = process.env.AI_DIALER_TOOL_SECRET;
  const received = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !received || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
