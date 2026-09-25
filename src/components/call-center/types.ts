export interface VoiceParticipant {
  id: string;
  userId: string;
  role: string;
  mode: string | null;
  callSid: string | null;
  joinedAt: string | null;
  endedAt: string | null;
}
export interface VoiceCall {
  id: string;
  agentId: string | null;
  leadId: string | null;
  direction: string;
  workflow?: string;
  campaignId?: string | null;
  openerId?: string | null;
  qualifiedAt?: string | null;
  qualifiedDebt?: number | null;
  qualificationNotes?: string | null;
  qualifiedDebts?:
    { key: string; id?: string; creditorName: string; amount: number }[] | null;
  transferRequestKey?: string | null;
  transferRequestedAt?: string | null;
  transferManagerId?: string | null;
  transferReviewedAt?: string | null;
  transferTargetId?: string | null;
  transferReadyAt?: string | null;
  transferReason?: string | null;
  salesStage?: string;
  closerHandoffId?: string | null;
  status: string;
  phoneNumber: string;
  fromNumber: string;
  held: boolean;
  disposition: string | null;
  notes: string | null;
  recordingSid: string | null;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  participants: VoiceParticipant[];
  queue?: { name: string } | null;
  call?: {
    lead?: {
      id: string;
      contactName: string;
      businessName: string;
      totalDebtEst?: number | null;
      numberOfLenders?: number | null;
      source?: string;
      brand?: string | null;
      sfId?: string | null;
      debts?: { id: string; creditorName: string | null; amount: number }[];
    } | null;
  } | null;
}
export interface Agent {
  userId: string;
  status: string;
  activeCallId: string | null;
  heartbeatAt: string;
  user?: { name: string };
  standbyReady?: boolean;
  closerOpen?: boolean;
}
export interface Queue {
  id: string;
  name: string;
  phoneNumber: string;
  enabled: boolean;
  greeting: string;
  maxWaitSeconds: number;
  members: { userId: string }[];
  _count: { calls: number };
}
export interface Overview {
  userId: string;
  supervisor: boolean;
  setup: {
    enabled: boolean;
    ready: boolean;
    recording: boolean;
    missing?: string[];
  };
  me: Agent | null;
  agents: Agent[];
  queues: Queue[];
  calls: VoiceCall[];
  campaigns: {
    id: string;
    name: string;
    script: string | null;
    dialerMode: string;
    _count: { contacts: number };
  }[];
  users: { id: string; name: string }[];
  sales?: {
    role: string;
    access: {
      opener: boolean;
      closer: boolean;
      floor: boolean;
      operations: boolean;
      home: string;
    };
    config: { tier1Max: number; tier2Max: number };
    roster: {
      id: string;
      name: string;
      role: string;
      tier: number | null;
      state: string;
      fresh: boolean;
      changedAt?: string | null;
      open: boolean;
      callId: string | null;
    }[];
    handoffs: {
      id: string;
      createdAt: string;
      leadId: string | null;
      clientName: string | null;
      debt: number | null;
      status: string;
      closerId: string | null;
      fronterId: string | null;
      fronter: { name: string } | null;
      closer: { name: string } | null;
    }[];
  };
  outbound?: {
    webCounts?: { waiting: number; overdue: number };
    canConfigureWeb: boolean;
    settings: {
      webEnabled: boolean;
      webMemberIds: string[];
      ownerFirst: boolean;
    } | null;
    webLeads: {
      leadId: string;
      receivedAt: string;
      deadlineAt: string;
      attemptedAt: string | null;
      status: string;
      reason: string | null;
      lead: { contactName: string; businessName: string };
      sla: { seconds: number; missed: boolean; attempted: boolean };
    }[];
    coldCampaigns: {
      campaignId: string;
      status: string;
      maxLines: number;
      lineScope: string;
      pauseReason: string | null;
      campaign: { name: string };
      attempts: number;
      answered: number;
      abandoned: number;
      inFlight: number;
    }[];
  };
}
export interface DialInput {
  phone?: string;
  leadId?: string;
  accountId?: string;
  opportunityId?: string;
  campaignId?: string;
}
