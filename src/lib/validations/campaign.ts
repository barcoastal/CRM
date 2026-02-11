import { z } from "zod";

export const DIALER_MODES = ["POWER", "PREVIEW", "MANUAL"] as const;
export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;

export type DialerMode = (typeof DIALER_MODES)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  dialerMode: z.enum(DIALER_MODES).default("POWER"),
  script: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timezone: z.string().default("America/New_York"),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).optional(),
  description: z.string().optional(),
  dialerMode: z.enum(DIALER_MODES).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  script: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timezone: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
