import { z } from "zod";
import {
  CASE_RECORD_TYPES,
  CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_ORIGINS,
  ESCALATION_LEVELS,
} from "@/lib/record-types";

export const createCaseSchema = z.object({
  recordType: z.enum(CASE_RECORD_TYPES).default("SUPPORT"),
  subject: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  status: z.enum(CASE_STATUSES).default("NEW"),
  priority: z.enum(CASE_PRIORITIES).default("NORMAL"),
  origin: z.enum(CASE_ORIGINS).default("PHONE"),
  escalationLevel: z.enum(ESCALATION_LEVELS).default("L1"),

  accountId: z.string().cuid().optional().nullable(),
  contactId: z.string().cuid().optional().nullable(),
  programPlanId: z.string().cuid().optional().nullable(),
  draftId: z.string().cuid().optional().nullable(),

  ownerId: z.string().cuid().optional().nullable(),
  ownerGroupId: z.string().cuid().optional().nullable(),
  parentCaseId: z.string().cuid().optional().nullable(),
  requiresApproval: z.boolean().default(false),
  slaDueAt: z.string().datetime().optional().nullable(),
});

export const updateCaseSchema = createCaseSchema.partial();

export const assignCaseSchema = z.object({
  ownerId: z.string().cuid().optional().nullable(),
  ownerGroupId: z.string().cuid().optional().nullable(),
}).refine((d) => !!d.ownerId || !!d.ownerGroupId || d.ownerId === null || d.ownerGroupId === null, {
  message: "Either ownerId or ownerGroupId must be specified",
});

export const escalateCaseSchema = z.object({
  reason: z.string().optional(),
});

export const closeCaseSchema = z.object({
  outcome: z.enum(["RESOLVED", "CLOSED"]).default("RESOLVED"),
  resolutionNote: z.string().optional(),
});

export const approveCaseSchema = z.object({
  approvalNotes: z.string().optional(),
});

export const skipPaymentSchema = z.object({
  programPlanId: z.string().cuid(),
  reason: z.string().min(1),
  cancelNextDraft: z.boolean().optional(),
});

export const createCaseCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  isInternal: z.boolean().default(true),
});
