import { z } from "zod";

const filter = z.object({
  field: z.string().min(1),
  op: z.enum(["EQ", "NEQ", "CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "IN", "NOT_IN", "GT", "GTE", "LT", "LTE", "IS_NULL", "IS_NOT_NULL"]),
  value: z.unknown().optional(),
});

export const createListViewSchema = z.object({
  entity: z.string().min(1),
  name: z.string().min(1).max(255),
  developerName: z.string().optional().nullable(),
  filters: z.array(filter).default([]),
  columns: z.array(z.string()).optional().nullable(),
  sortField: z.string().optional().nullable(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  isShared: z.boolean().default(false),
  isPinned: z.boolean().default(false),
});

export const updateListViewSchema = createListViewSchema.partial().omit({ entity: true });
