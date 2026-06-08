/**
 * SF Forecast Categories. The same 5 buckets Salesforce uses on its native
 * Forecasting page. Stored as a string on Opportunity.forecastCategory.
 *
 * Stage -> category mapping is a default. Reps can override per Opp via the
 * CategoryPicker on the forecasting page or the opp detail header.
 */

export const FORECAST_CATEGORIES = [
  "COMMIT",
  "BEST_CASE",
  "PIPELINE",
  "CLOSED",
  "OMITTED",
] as const;
export type ForecastCategory = (typeof FORECAST_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ForecastCategory, string> = {
  COMMIT: "Commit",
  BEST_CASE: "Best Case",
  PIPELINE: "Pipeline",
  CLOSED: "Closed",
  OMITTED: "Omitted",
};

// Color hints used by tiles + rollup table
export const CATEGORY_COLOR: Record<ForecastCategory, string> = {
  COMMIT: "#1a7d37",
  BEST_CASE: "#3052ff",
  PIPELINE: "#b48c00",
  CLOSED: "#5c5c8a",
  OMITTED: "#706e6b",
};

/**
 * Default mapping from Opportunity.stage to ForecastCategory. Used when no
 * explicit override is set. Stage strings vary in case + separator across the
 * SF migration so we normalise to upper and check substrings.
 */
export function defaultCategoryForStage(stage: string): ForecastCategory {
  const s = (stage ?? "").toUpperCase().replace(/\s+/g, "_");
  // Closed-won first payment completed maps to CLOSED (already booked revenue).
  if (s.includes("CLOSED_WON_FIRST_PAYMENT_COMPLETED")) return "CLOSED";
  if (s.includes("CLOSED_LOST")) return "OMITTED";
  if (s.includes("ARCHIVED")) return "OMITTED";
  if (s.includes("CLOSED_WON")) return "COMMIT";
  if (
    s.includes("CONTRACT_SENT") ||
    s.includes("CONTRACT_SIGNED") ||
    s.includes("COMMIT")
  )
    return "COMMIT";
  if (
    s.includes("AGREEMENTS_RECEIVED") ||
    s.includes("READY_TO_CLOSE") ||
    s.includes("PROPOSAL") ||
    s.includes("NEGOTIATION")
  )
    return "BEST_CASE";
  return "PIPELINE";
}

export function isForecastCategory(v: string): v is ForecastCategory {
  return (FORECAST_CATEGORIES as readonly string[]).includes(v);
}
