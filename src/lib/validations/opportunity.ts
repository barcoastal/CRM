import { z } from "zod";

export const OPPORTUNITY_STAGES = [
  "WORKING_OPPORTUNITY",
  "WAITING_FOR_AGREEMENTS",
  "READY_TO_CLOSE",
  "CONTRACT_SENT",
  "CONTRACT_SIGNED",
  "ARCHIVED",
  "CLOSED_WON_FIRST_PAYMENT",
  "CLOSED",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const createOpportunitySchema = z.object({
  leadId: z.string().min(1, "Lead is required"),
  estimatedValue: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  expectedCloseDate: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const updateOpportunitySchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  estimatedValue: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  expectedCloseDate: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
