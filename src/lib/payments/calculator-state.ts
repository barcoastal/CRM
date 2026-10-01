import { z } from "zod";

const money = z.number().finite().nonnegative().max(100_000_000);
const row = z.object({
  index: z.number().int(),
  date: z.string().datetime(),
  weeklyDraftAmount: money,
  programFee: money,
  retainerFee: money,
  setupFee: money,
  bankFee: money,
  serviceFee: money,
  citadelFee: money,
  escrowAmount: money,
  runningBalance: z.number().finite(),
  status: z.string(),
  _child: z.boolean().optional(),
  _after: z.number().int(),
});
export const calculatorStateSchema = z.object({
  version: z.literal(1),
  termMonths: z.number().int().min(1).max(30),
  firstPaymentDate: z.iso.date(),
  weeklyPaymentDay: z.enum([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]),
  paymentProcessor: z.string().max(80),
  moveDrafts: z.boolean().optional(),
  splitRows: z
    .array(
      z.object({
        date: z.iso.date(),
        amount: money.refine((n) => n > 0),
        bankFee: money,
        citadelFee: money,
        setupFee: money,
      }),
    )
    .max(150)
    .nullable(),
  skipped: z.array(z.number().int()).max(300),
  rowEdits: z.record(
    z.string(),
    z.object({ date: z.iso.date(), amount: money.refine((n) => n > 0) }),
  ),
  extraRows: z.array(row).max(150),
});
export type CalculatorState = z.infer<typeof calculatorStateSchema>;
export function readCalculatorState(value: unknown): CalculatorState | null {
  const result = calculatorStateSchema.safeParse(value);
  return result.success ? result.data : null;
}
