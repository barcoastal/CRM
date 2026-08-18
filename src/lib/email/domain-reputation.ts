// src/lib/email/domain-reputation.ts
/**
 * Deliverability health score (0-100) from our own send data plus DNS auth and
 * blacklist status. Weighting: auth 30, bounce 25, complaint 25, blacklist 15,
 * engagement 5. All inputs are already-computed values; this module is pure.
 */
import type { AuthStatus } from "./domain-dns";

export interface ScoreInput {
  spf: AuthStatus;
  dkim: AuthStatus;
  dmarc: AuthStatus;
  bounceRate: number; // percent
  complaintRate: number; // percent
  openRate: number; // percent
  blacklisted: number; // count of zones listing us
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function healthScore(i: ScoreInput): number {
  // Auth: 10 points each, PASS=full, UNKNOWN=half, FAIL=0.
  const authPts = (s: AuthStatus) => (s === "PASS" ? 10 : s === "UNKNOWN" ? 5 : 0);
  const auth = authPts(i.spf) + authPts(i.dkim) + authPts(i.dmarc); // 0..30

  // Bounce: 25 at 0%, linearly to 0 at 10%+.
  const bounce = clamp(25 * (1 - i.bounceRate / 10), 0, 25);
  // Complaint: 25 at 0%, to 0 at 0.5%+ (spam complaints matter a lot).
  const complaint = clamp(25 * (1 - i.complaintRate / 0.5), 0, 25);
  // Blacklist: 15 if clean, minus 8 per listing.
  const blacklist = clamp(15 - i.blacklisted * 8, 0, 15);
  // Engagement: 5 at 20%+ open rate, scaled down.
  const engagement = clamp(5 * (i.openRate / 20), 0, 5);

  return Math.round(clamp(auth + bounce + complaint + blacklist + engagement, 0, 100));
}

export function grade(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}
