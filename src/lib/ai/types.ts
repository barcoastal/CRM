export interface TranscriptEntry {
  speaker: 'agent' | 'lead';
  text: string;
  timestamp: number; // seconds from call start
}

export interface CoachingTip {
  id: string;
  type: 'buying_signal' | 'objection' | 'suggestion' | 'warning';
  text: string;
  timestamp: number;
}

export interface CallFeedbackData {
  overallScore: number;
  talkRatio: number;
  objectionHandling: number;
  closingAttempt: boolean;
  keyMoments: { timestamp: number; type: string; description: string }[];
  improvements: string[];
  strengths: string[];
  summary: string;
}

export interface TranscriptionService {
  getTranscriptForCall(callDurationSeconds: number): TranscriptEntry[];
}

export interface CoachingService {
  getTipsForTranscript(entries: TranscriptEntry[]): CoachingTip[];
}

export interface FeedbackService {
  generateFeedback(transcript: TranscriptEntry[]): CallFeedbackData;
}
