import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Pure field helpers now live in a prisma-free module so client components can
// use them without bundling prisma; re-exported here for server-side callers.
export { resolveFieldValue, isFieldFilled } from "./field-values";

/**
 * Server-side helper for SF-style Path Guidance + Key Fields.
 *
 * A PathGuidance row exists per (entityType, stage). It carries:
 *   - keyFields: an ordered list of dotted field paths used as a Key Fields
 *     checklist on the rep's record detail page.
 *   - guidance: a markdown blob shown in the Guidance for Success panel.
 *
 * Both are surfaced next to the SF Path tracker so the rep knows what to do
 * at the current stage and what to fill in before advancing.
 */

export interface GuidanceRow {
  keyFields: string[];
  guidance: string | null;
}

/**
 * Fetch the active guidance row for an entity+stage pair. Cached per request
 * via React `cache()` so multiple components on the same page share a single
 * DB hit.
 */
export const getGuidance = cache(
  async (entityType: string, stage: string): Promise<GuidanceRow | null> => {
    if (!entityType || !stage) return null;
    const row = await prisma.pathGuidance.findUnique({
      where: { entityType_stage: { entityType, stage } },
    });
    if (!row || !row.isActive) return null;
    const keyFields = Array.isArray(row.keyFields)
      ? (row.keyFields as unknown[]).filter((f): f is string => typeof f === "string")
      : [];
    return {
      keyFields,
      guidance: row.guidance ?? null,
    };
  },
);

