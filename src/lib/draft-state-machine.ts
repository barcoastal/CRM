/**
 * Pure state machine for the Draft entity (a single ACH pull on a ProgramPlan).
 * States and transitions match the SF Draft__c lifecycle.
 *
 *   SCHEDULED ──run→ PROCESSING ──webhook(success)→ SUCCESS  (terminal)
 *                              ──webhook(failure)→ FAILED   (then maybe retry)
 *                              ──manual cancel  → CANCELLED  (terminal)
 *   SCHEDULED ──manual cancel→ CANCELLED                      (terminal)
 *   FAILED    ──schedule retry→ RETRYING ──run→ PROCESSING
 *   FAILED    ──no retries left→ FAILED (terminal)
 */

export const DRAFT_STATUSES = [
  "SCHEDULED",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "RETRYING",
  "CANCELLED",
] as const;
export type DraftStatus = typeof DRAFT_STATUSES[number];

export type DraftEvent =
  | { type: "RUN" }
  | { type: "WEBHOOK_SUCCESS" }
  | { type: "WEBHOOK_FAILURE"; returnCode?: string; returnReason?: string }
  | { type: "CANCEL" }
  | { type: "SCHEDULE_RETRY" };

export const TERMINAL_DRAFT_STATUSES: readonly DraftStatus[] = ["SUCCESS", "CANCELLED"];

export function isTerminal(status: DraftStatus): boolean {
  return (TERMINAL_DRAFT_STATUSES as readonly string[]).includes(status);
}

const TRANSITIONS: Record<DraftStatus, Partial<Record<DraftEvent["type"], DraftStatus>>> = {
  SCHEDULED: {
    RUN: "PROCESSING",
    CANCEL: "CANCELLED",
  },
  PROCESSING: {
    WEBHOOK_SUCCESS: "SUCCESS",
    WEBHOOK_FAILURE: "FAILED",
    CANCEL: "CANCELLED",
  },
  FAILED: {
    SCHEDULE_RETRY: "RETRYING",
  },
  RETRYING: {
    RUN: "PROCESSING",
    CANCEL: "CANCELLED",
  },
  SUCCESS: {}, // terminal
  CANCELLED: {}, // terminal
};

export class DraftTransitionError extends Error {
  constructor(public from: DraftStatus, public eventType: string) {
    super(`Invalid Draft transition: ${from} on ${eventType}`);
    this.name = "DraftTransitionError";
  }
}

/**
 * Pure: given the current status and an event, return the next status.
 * Throws DraftTransitionError if the event is not allowed in the current state.
 */
export function nextDraftStatus(current: DraftStatus, event: DraftEvent): DraftStatus {
  const allowed = TRANSITIONS[current]?.[event.type];
  if (!allowed) throw new DraftTransitionError(current, event.type);
  return allowed;
}

/**
 * Pure: given a draft's attempt counts and the last failure date, compute the
 * date the next retry should run. Returns null when no further retry is allowed
 * (max attempts reached).
 *
 * Default policy: 5 business days between attempts. We approximate "business
 * days" by adding 5 days and skipping over Saturday/Sunday; that matches what
 * ACH processors realistically schedule.
 */
export function computeNextRetryDate(args: {
  attemptNumber: number;
  maxAttempts: number;
  lastFailureDate: Date;
  daysBetween?: number;
}): Date | null {
  if (args.attemptNumber >= args.maxAttempts) return null;

  const between = args.daysBetween ?? 5;
  const d = new Date(args.lastFailureDate);
  let added = 0;
  while (added < between) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++; // skip weekends
  }
  return d;
}

/**
 * Pure: should this Draft be retried after a failure? Encapsulates retry policy.
 */
export function shouldRetry(args: { attemptNumber: number; maxAttempts: number; returnCode?: string | null }): boolean {
  // Hard returns (account closed, no account, fraud) are not retryable
  const HARD_RETURNS = new Set(["R02", "R03", "R04", "R07", "R08", "R16", "R20", "R29"]);
  if (args.returnCode && HARD_RETURNS.has(args.returnCode)) return false;
  return args.attemptNumber < args.maxAttempts;
}
