import { z } from "zod";
import { TASK_RECORD_TYPES, TASK_TYPES, TASK_STATUSES } from "@/lib/record-types";

export const createTaskSchema = z.object({
  recordType: z.enum(TASK_RECORD_TYPES).default("ACTIVITY"),
  subject: z.string().min(1).max(255),
  type: z.enum(TASK_TYPES).default("TASK"),
  status: z.enum(TASK_STATUSES).default("NOT_STARTED"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),

  accountId: z.string().cuid().optional().nullable(),
  opportunityId: z.string().cuid().optional().nullable(),
  debtId: z.string().cuid().optional().nullable(),
  programPlanId: z.string().cuid().optional().nullable(),
  leadId: z.string().cuid().optional().nullable(),
  contactId: z.string().cuid().optional().nullable(),

  ownerId: z.string().cuid().optional().nullable(),

  dueDate: z.string().datetime().optional().nullable(),
  reminderAt: z.string().datetime().optional().nullable(),

  disposition: z.string().optional().nullable(),
  callbackDate: z.string().datetime().optional().nullable(),
  outcome: z.string().optional().nullable(),
  callId: z.string().cuid().optional().nullable(),

  notes: z.string().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial();
