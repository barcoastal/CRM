/**
 * Step kinds for EngagementSequence.steps. Pure config definitions + Zod
 * validators per kind. The engine in engine.ts reads kind + config to drive
 * execution.
 *
 * Branch steps reference other steps by `order` (not by step id) so authors
 * can clone / reorder sequences without breaking refs. yes/no go-to are
 * 1-based positions in the step list. 0 / negative / out-of-range values
 * are treated as "end the sequence" by the engine.
 */

import { z } from "zod";

export const STEP_KINDS = [
  "send_email",
  "wait",
  "branch_on_open",
  "branch_on_click",
  "update_score",
  "add_to_list",
  "remove_from_list",
  "task",
  "exit",
] as const;

export type StepKind = (typeof STEP_KINDS)[number];

export interface StepDef {
  send_email: { templateId: string; fromUserId?: string };
  wait: { days?: number; hours?: number };
  branch_on_open: { yesGoToStepOrder: number; noGoToStepOrder: number; waitHours: number };
  branch_on_click: { yesGoToStepOrder: number; noGoToStepOrder: number; waitHours: number };
  update_score: { delta: number };
  add_to_list: { listId: string };
  remove_from_list: { listId: string };
  task: { subject: string; dueOffsetDays?: number; ownerUserId?: string };
  exit: object;
}

// Per-kind Zod schemas. Used by the API to validate config payloads before
// persisting steps. Numbers come in as numbers from JSON.
export const stepConfigSchemas = {
  send_email: z.object({
    templateId: z.string().min(1, "Pick a template"),
    fromUserId: z.string().optional(),
  }),
  wait: z
    .object({
      days: z.number().int().min(0).optional(),
      hours: z.number().int().min(0).optional(),
    })
    .refine((v) => (v.days ?? 0) + (v.hours ?? 0) > 0, {
      message: "Wait must be greater than zero",
    }),
  branch_on_open: z.object({
    yesGoToStepOrder: z.number().int(),
    noGoToStepOrder: z.number().int(),
    waitHours: z.number().int().min(0).max(24 * 14),
  }),
  branch_on_click: z.object({
    yesGoToStepOrder: z.number().int(),
    noGoToStepOrder: z.number().int(),
    waitHours: z.number().int().min(0).max(24 * 14),
  }),
  update_score: z.object({
    delta: z.number().int(),
  }),
  add_to_list: z.object({
    listId: z.string().min(1),
  }),
  remove_from_list: z.object({
    listId: z.string().min(1),
  }),
  task: z.object({
    subject: z.string().min(1),
    dueOffsetDays: z.number().int().min(0).optional(),
    ownerUserId: z.string().optional(),
  }),
  exit: z.object({}).passthrough(),
} as const satisfies Record<StepKind, z.ZodTypeAny>;

export function validateStepConfig(kind: string, config: unknown):
  | { ok: true; config: unknown }
  | { ok: false; error: string } {
  if (!STEP_KINDS.includes(kind as StepKind)) {
    return { ok: false, error: `Unknown step kind: ${kind}` };
  }
  const schema = stepConfigSchemas[kind as StepKind];
  const parsed = schema.safeParse(config ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, config: parsed.data };
}

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  send_email: "Send Email",
  wait: "Wait",
  branch_on_open: "Branch on Open",
  branch_on_click: "Branch on Click",
  update_score: "Update Score",
  add_to_list: "Add to List",
  remove_from_list: "Remove from List",
  task: "Create Task",
  exit: "Exit",
};

export const STEP_KIND_DESCRIPTIONS: Record<StepKind, string> = {
  send_email: "Send a templated email to the lead.",
  wait: "Pause the sequence for N days / hours before the next step.",
  branch_on_open: "After the last email, branch based on whether the lead opened it.",
  branch_on_click: "After the last email, branch based on whether the lead clicked a link.",
  update_score: "Add (or subtract) points to the lead's score.",
  add_to_list: "Add the lead to a Lead List.",
  remove_from_list: "Remove the lead from a Lead List.",
  task: "Create a follow-up task on the lead.",
  exit: "End the sequence immediately.",
};
