export type CallSessionStatus =
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "no-answer"
  | "busy"
  | "failed"
  | "voicemail";

export interface CallSession {
  sid: string;
  status: CallSessionStatus;
  duration: number;
  to: string;
  from: string;
  startedAt: Date;
  answeredAt?: Date;
}

export interface TelephonyProvider {
  makeCall(params: {
    to: string;
    from: string;
    agentId: string;
  }): Promise<CallSession>;
  endCall(callSid: string): Promise<void>;
  holdCall(callSid: string): Promise<void>;
  resumeCall(callSid: string): Promise<void>;
  muteCall(callSid: string): Promise<void>;
  unmuteCall(callSid: string): Promise<void>;
  getCallStatus(callSid: string): Promise<CallSession>;
}

export type CallStatusCallback = (
  sid: string,
  status: CallSessionStatus
) => void;
