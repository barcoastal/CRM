// Shared, deterministic policy for the two automatic outbound workflows.
export const WEB_SLA_MS = 60_000;
export const COLD_ABANDON_LIMIT = 0.02;
export function webDeadline(receivedAt: Date) {
  return new Date(receivedAt.getTime() + WEB_SLA_MS);
}
export function webSla(
  receivedAt: Date,
  attemptedAt: Date | null,
  now = new Date(),
) {
  const elapsed = (attemptedAt || now).getTime() - receivedAt.getTime();
  return {
    seconds: Math.max(0, Math.ceil((WEB_SLA_MS - elapsed) / 1000)),
    missed: elapsed > WEB_SLA_MS,
    attempted: !!attemptedAt,
  };
}
export function coldCapacity(input: {
  readyAgents: number;
  maxLines: number;
  lineScope: string;
  inFlight: number;
  answered: number;
  abandoned: number;
  attempts: number;
  priorityWaiting: boolean;
}) {
  if (input.priorityWaiting || input.readyAgents <= 0) return 0;
  if (
    input.abandoned > 0 &&
    input.abandoned / Math.max(1, input.answered) >= COLD_ABANDON_LIMIT
  )
    return 0;
  const ceiling = Math.min(
    100,
    input.maxLines * (input.lineScope === "AGENT" ? input.readyAgents : 1),
  );
  // Start with ten lines per ready agent; reduce pacing as observed pickup rises.
  const pickup =
    input.attempts >= 20 ? Math.max(0.1, input.answered / input.attempts) : 0.1;
  const paced = Math.max(
    input.readyAgents,
    Math.floor(input.readyAgents / pickup),
  );
  return Math.max(0, Math.min(ceiling, paced) - input.inFlight);
}
export function machineAnswer(answeredBy: string) {
  return answeredBy.startsWith("machine") || answeredBy === "fax";
}
