export type ActivityType = "TASK" | "EVENT" | "CALL" | "EMAIL" | "SMS" | "NOTE" | "NOTIFICATION";

interface ActivityTask {
  id: string;
  subject: string;
  type: string;
  status: string;
  recordType?: string;
  sfId?: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  outcome?: string | null;
  disposition?: string | null;
}

const easternParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function easternWallTime(date: Date): number {
  const parts = Object.fromEntries(easternParts.formatToParts(date).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

/** Legacy Five9 subjects carry the call time; SF ActivityDate is only a due date. */
export function importedCallSubject(subject: string): { subject: string; date: Date } | null {
  if (!/^Call-/i.test(subject)) return null;
  const match = subject.match(/[-\s]+(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s*(EST|EDT)?\s*$/i);
  if (!match || match.index == null) return null;
  const year = +(match[1] ?? match[6]), month = +(match[2] ?? match[4]), day = +(match[3] ?? match[5]);
  const hour = +match[7], minute = +match[8], second = +(match[9] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59 || second > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const wall = Date.UTC(year, month - 1, day, hour % 12 + (match[10].toUpperCase() === "PM" ? 12 : 0), minute, second);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  const zone = match[11]?.toUpperCase();
  let date = new Date(wall + (zone === "EDT" ? 4 : 5) * 3_600_000);
  if (!zone) {
    // The second legacy format omits the zone but uses the same Eastern clock.
    date = new Date(date.getTime() + wall - easternWallTime(date));
    if (easternWallTime(date) !== wall) return null; // Nonexistent DST wall time.
  }
  return { subject: subject.slice(0, match.index).trim(), date };
}

export function taskActivity(task: ActivityTask) {
  const done = task.status === "COMPLETED";
  let type: ActivityType = "TASK";
  if (["CALL", "EMAIL", "SMS", "NOTE", "EVENT", "NOTIFICATION"].includes(task.type)) type = task.type as ActivityType;
  else if (done && (task.recordType === "DISPOSITION" || /^(?:Stage|Status|Transfer Qualification) changed to\b/i.test(task.subject))) type = "NOTIFICATION";
  else if (done && task.sfId && /^Email:\s/i.test(task.subject)) type = "EMAIL";
  const call = task.sfId && done && type === "CALL" ? importedCallSubject(task.subject) : null;
  return {
    id: task.id, type, subject: call?.subject ?? task.subject,
    meta: task.outcome ?? task.disposition ?? null,
    date: call?.date ?? (done ? task.completedAt ?? task.createdAt : task.dueDate ?? task.createdAt),
    done,
  };
}

/** Explicit timezone prevents server/client and browser locale disagreements. */
export function formatActivityDate(value: Date | string): string {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}
