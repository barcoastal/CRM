/**
 * Port of SF offerTrigger / OfferHandler.
 * Source: docs/sf-export/sfdx-raw/classes/OfferHandler.cls
 *
 * Ported behaviors:
 *  - beforeInsert: reject offers created with status = CANCELLED
 *  - beforeUpdate: reject status changes that move OUT of CANCELLED
 *  - afterUpdate: when offer.status flips to CANCELLED, cancel its related
 *    Settlement (unless that settlement is already CANCELLED / PAID)
 */

import type { Offer } from "@/generated/prisma/client";
import type { Trigger } from "./types";

type OfferWrite = Partial<Offer> & Record<string, unknown>;

export const offerTrigger: Trigger<Offer, OfferWrite> = {
  beforeInsert({ next }) {
    if (next.status === "CANCELLED") {
      throw new Error("Offer cannot be created with cancelled status.");
    }
  },
  beforeUpdate({ next, prev }) {
    if (
      next.status !== undefined &&
      next.status !== prev.status &&
      prev.status === "CANCELLED"
    ) {
      throw new Error("Offer status cannot be moved from cancelled.");
    }
  },
  async afterUpdate({ row, prev, ctx }) {
    if (row.status !== "CANCELLED" || prev.status === "CANCELLED") return;
    // Cancel related settlement if it's still in-flight
    await ctx.prisma.settlement.updateMany({
      where: {
        offerId: row.id,
        status: { notIn: ["CANCELLED", "PAID"] },
      },
      data: { status: "CANCELLED" },
    });
  },
};
