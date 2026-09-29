import { z } from "zod";

const money = z
  .number()
  .finite()
  .nonnegative()
  .max(100_000_000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places",
  );
export const wirePaymentSchema = z
  .object({
    programPlanId: z.string().min(1),
    requestKey: z.string().uuid(),
    reference: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .transform((v) => v.toUpperCase()),
    receivedAt: z.iso
      .date()
      .refine(
        (v) =>
          v <=
          new Date().toLocaleDateString("en-CA", {
            timeZone: "America/New_York",
          }),
        "Receipt date cannot be in the future",
      ),
    grossAmount: money.refine((n) => n > 0, "Amount must be positive"),
    wireFee: money,
    wireType: z.enum(["Regular", "Settlement"]).default("Regular"),
    legalFeePaid: z.boolean().default(false),
    notes: z.string().trim().max(4000).optional(),
  })
  .strict()
  .refine((v) => v.wireFee < v.grossAmount, {
    path: ["wireFee"],
    message: "Fee must be less than the amount received",
  });
