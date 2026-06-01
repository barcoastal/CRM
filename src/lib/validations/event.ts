import { z } from "zod";
import { EVENT_RECORD_TYPES, EVENT_STATUSES } from "@/lib/record-types";

export const createEventSchema = z.object({
  recordType: z.enum(EVENT_RECORD_TYPES).default("EVENT"),
  subject: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(EVENT_STATUSES).default("SCHEDULED"),

  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),

  accountId: z.string().cuid().optional().nullable(),
  opportunityId: z.string().cuid().optional().nullable(),
  leadId: z.string().cuid().optional().nullable(),
  contactId: z.string().cuid().optional().nullable(),

  ownerId: z.string().cuid().optional().nullable(),

  disposition: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),

  notes: z.string().optional().nullable(),
}).refine((d) => new Date(d.endAt).getTime() >= new Date(d.startAt).getTime(), {
  message: "endAt must be at or after startAt",
  path: ["endAt"],
});

export const updateEventSchema = z.object({
  recordType: z.enum(EVENT_RECORD_TYPES).optional(),
  subject: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(EVENT_STATUSES).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  accountId: z.string().cuid().optional().nullable(),
  opportunityId: z.string().cuid().optional().nullable(),
  leadId: z.string().cuid().optional().nullable(),
  contactId: z.string().cuid().optional().nullable(),
  ownerId: z.string().cuid().optional().nullable(),
  disposition: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
