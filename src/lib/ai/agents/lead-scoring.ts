/**
 * Lead Scoring Agent (Mock)
 *
 * Scores leads 0-100 based on their data to prioritize outreach.
 * In production this would call an ML model; here we use a deterministic
 * rule-based algorithm that mimics what an AI would return.
 */

interface LeadScoringInput {
  totalDebtEst?: number | null;
  annualRevenue?: number | null;
  source: string;
  industry?: string | null;
  email?: string | null;
  ein?: string | null;
}

interface LeadScoringResult {
  score: number;
  reason: string;
}

const HIGH_SETTLEMENT_INDUSTRIES = ["Construction", "Healthcare", "Automotive"];

export function scoreLead(lead: LeadScoringInput): LeadScoringResult {
  let score = 50;
  const reasons: string[] = [];

  // --- Debt amount scoring ---
  if (lead.totalDebtEst != null) {
    if (lead.totalDebtEst > 100_000) {
      score += 15;
      reasons.push(`high total debt ($${formatK(lead.totalDebtEst)})`);
    } else if (lead.totalDebtEst > 50_000) {
      score += 10;
      reasons.push(`moderate debt ($${formatK(lead.totalDebtEst)})`);
    } else if (lead.totalDebtEst > 25_000) {
      score += 5;
      reasons.push(`some debt ($${formatK(lead.totalDebtEst)})`);
    }
  }

  // --- Revenue scoring ---
  if (lead.annualRevenue != null) {
    if (lead.annualRevenue > 500_000) {
      score += 10;
      reasons.push("strong revenue business");
    } else if (lead.annualRevenue > 200_000) {
      score += 5;
      reasons.push("moderate revenue business");
    }
  }

  // --- Source scoring ---
  if (lead.source === "REFERRAL") {
    score += 10;
    reasons.push("referred lead");
  } else if (lead.source === "WEBSITE") {
    score += 5;
    reasons.push("inbound website lead");
  }

  // --- Industry scoring ---
  if (
    lead.industry &&
    HIGH_SETTLEMENT_INDUSTRIES.some(
      (ind) => ind.toLowerCase() === lead.industry!.toLowerCase()
    )
  ) {
    score += 5;
    reasons.push(
      `${lead.industry.toLowerCase()} industry settles well`
    );
  }

  // --- Contact completeness ---
  if (lead.email) {
    score += 3;
  }
  if (lead.ein) {
    score += 3;
    reasons.push("EIN on file");
  }

  // --- Debt-to-revenue ratio ---
  if (
    lead.totalDebtEst != null &&
    lead.annualRevenue != null &&
    lead.annualRevenue > 0
  ) {
    const ratio = lead.totalDebtEst / lead.annualRevenue;
    if (ratio > 0.2) {
      score += 5;
      reasons.push(
        `high debt-to-revenue ratio (${(ratio * 100).toFixed(1)}%)`
      );
    }
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Build natural-language reason
  const reason = buildReason(reasons, score);

  return { score, reason };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function buildReason(reasons: string[], score: number): string {
  if (reasons.length === 0) {
    return score >= 50
      ? "Baseline score with no additional qualifying signals."
      : "Low data availability — consider enriching this lead.";
  }

  // Capitalise first reason
  const parts = [...reasons];
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);

  const detail = parts.join(", ");

  if (score >= 75) {
    return `${detail}. Strong candidate for enrollment.`;
  }
  if (score >= 50) {
    return `${detail}. Worth pursuing — gather more information.`;
  }
  return `${detail}. Lower priority — may need re-engagement later.`;
}
