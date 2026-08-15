/**
 * Flow re-entry safety. Decides whether a record may start a new run of a
 * flow given the flow's policy and the record's most recent prior run.
 */
export function shouldReenter(
  policy: string,
  cooldownDays: number,
  lastRunStartedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (policy === "ONCE") return lastRunStartedAt === null;
  if (policy === "COOLDOWN") {
    if (lastRunStartedAt === null) return true;
    const cutoff = new Date(now.getTime() - cooldownDays * 864e5);
    return lastRunStartedAt < cutoff;
  }
  return true; // ALWAYS and anything unrecognized
}
