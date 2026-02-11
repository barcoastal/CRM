import { MockTranscriptionService } from './mock-transcription';
import { MockCoachingService } from './mock-coaching';
import { MockFeedbackService } from './mock-feedback';
import type {
  TranscriptionService,
  CoachingService,
  FeedbackService,
} from './types';

export function createTranscriptionService(scenarioIndex?: number): TranscriptionService {
  return new MockTranscriptionService(scenarioIndex);
}

export function createCoachingService(): CoachingService {
  return new MockCoachingService();
}

export function createFeedbackService(): FeedbackService {
  return new MockFeedbackService();
}

export type {
  TranscriptEntry,
  CoachingTip,
  CallFeedbackData,
  TranscriptionService,
  CoachingService,
  FeedbackService,
} from './types';
