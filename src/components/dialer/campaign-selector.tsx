"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  contactCount: number;
}

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaignId: string | null;
  onSelect: (campaignId: string) => void;
  onStart: () => void;
  disabled?: boolean;
}

export function CampaignSelector({
  campaigns,
  selectedCampaignId,
  onSelect,
  onStart,
  disabled,
}: CampaignSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Campaign</label>
        <Select
          value={selectedCampaignId ?? undefined}
          onValueChange={onSelect}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a campaign..." />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                <div className="flex items-center gap-2">
                  <span>{campaign.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({campaign.contactCount} contacts)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={onStart}
        disabled={!selectedCampaignId || disabled}
        className="w-full"
        size="lg"
      >
        <Play className="size-4" />
        Start Dialing
      </Button>
    </div>
  );
}
