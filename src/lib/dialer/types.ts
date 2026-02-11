export interface DialerSession {
  id: string;
  campaignId: string;
  agentId: string;
  status: "active" | "paused" | "stopped";
  currentContactId?: string;
  stats: {
    callsMade: number;
    connected: number;
    noAnswer: number;
    busy: number;
    voicemail: number;
    enrolled: number;
    totalTalkTime: number;
  };
  startedAt: Date;
}

export interface DialerContact {
  id: string;
  leadId: string;
  businessName: string;
  contactName: string;
  phone: string;
  totalDebtEst: number | null;
  industry: string | null;
  score: number | null;
  attempts: number;
  priority: number;
}
