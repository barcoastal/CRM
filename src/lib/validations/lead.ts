import { z } from "zod";

export const LEAD_SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "MAILER",
  "PURCHASED_LIST",
  "COLD_CALL",
  "SOCIAL",
  "OTHER",
] as const;

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "CALLBACK",
  "OPPORTUNITY",
  "ENROLLED",
  "LOST",
  "DNC",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const createLeadSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  ein: z.string().optional().or(z.literal("")),
  industry: z.string().optional().or(z.literal("")),
  annualRevenue: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  totalDebtEst: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  numberOfLenders: z.coerce.number().int().min(0, "Cannot be negative").optional().or(z.literal("")),
  source: z.enum(LEAD_SOURCES).default("OTHER"),
  notes: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  // Marketing Attribution
  utmSource: z.string().optional().or(z.literal("")),
  utmMedium: z.string().optional().or(z.literal("")),
  utmCampaign: z.string().optional().or(z.literal("")),
  utmTerm: z.string().optional().or(z.literal("")),
  utmContent: z.string().optional().or(z.literal("")),
  // Click IDs
  eliClickId: z.string().optional().or(z.literal("")),
  redtrackClickId: z.string().optional().or(z.literal("")),
  gclid: z.string().optional().or(z.literal("")),
  fbclid: z.string().optional().or(z.literal("")),
});

export const updateLeadSchema = z.object({
  businessName: z.string().min(1, "Business name is required").optional(),
  contactName: z.string().min(1, "Contact name is required").optional(),
  phone: z.string().min(1, "Phone number is required").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  ein: z.string().optional().or(z.literal("")),
  industry: z.string().optional().or(z.literal("")),
  annualRevenue: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  totalDebtEst: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  numberOfLenders: z.coerce.number().int().min(0, "Cannot be negative").optional().or(z.literal("")),
  source: z.enum(LEAD_SOURCES).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  notes: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  score: z.coerce.number().min(0).max(100).optional(),
  nextFollowUpAt: z.string().optional().or(z.literal("")),
  // Marketing Attribution
  utmSource: z.string().optional().or(z.literal("")),
  utmMedium: z.string().optional().or(z.literal("")),
  utmCampaign: z.string().optional().or(z.literal("")),
  utmTerm: z.string().optional().or(z.literal("")),
  utmContent: z.string().optional().or(z.literal("")),
  // Click IDs
  eliClickId: z.string().optional().or(z.literal("")),
  redtrackClickId: z.string().optional().or(z.literal("")),
  gclid: z.string().optional().or(z.literal("")),
  fbclid: z.string().optional().or(z.literal("")),
});

export type CreateLeadInput = z.output<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
