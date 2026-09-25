export const TERMINAL = [
  "COMPLETED",
  "FAILED",
  "NO_ANSWER",
  "BUSY",
  "CANCELED",
  "ABANDONED",
];
export const DISPOSITIONS = [
  "INTERESTED",
  "CALLBACK",
  "NOT_INTERESTED",
  "NOT_QUALIFIED",
  "WRONG_NUMBER",
  "VOICEMAIL",
  "NO_ANSWER",
  "DNC",
  "ENROLLED",
] as const;
export type MonitorMode = "LISTEN" | "WHISPER" | "BARGE";
export function isTerminal(status: string) {
  return TERMINAL.includes(status);
}
export function phoneNumber(raw: string): string {
  if (!/^[+\d\s().-]+$/.test(raw))
    throw new Error("Enter a valid US or Canadian phone number.");
  const digits = raw.replace(/\D/g, "");
  const number = digits.length === 10 ? `1${digits}` : digits;
  if (!/^1[2-9]\d{2}[2-9]\d{6}$/.test(number))
    throw new Error("Enter a valid US or Canadian phone number.");
  return `+${number}`;
}
export function identity(userId: string) {
  return `crm_${Buffer.from(userId).toString("hex")}`;
}
export function userFromIdentity(value: string) {
  const hex = value.replace(/^client:/, "").match(/^crm_([a-f0-9]+)$/)?.[1];
  if (!hex || hex.length % 2) return null;
  return Buffer.from(hex, "hex").toString();
}
export function canSupervise(role: string, permissions: string[]) {
  return (
    ["ADMIN", "SUPER_ADMIN"].includes(role) ||
    permissions.includes("CallCenter.Supervise") ||
    permissions.includes("Modify.AllData")
  );
}
export function withinWindow(
  start: string | null,
  end: string | null,
  zone: string,
  now = new Date(),
) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const from = start || "09:00",
    to = end || "20:00";
  return from < to ? time >= from && time < to : time >= from || time < to;
}
export function nextCallStatus(current: string, event: string): string {
  if (isTerminal(current)) return current;
  const mapped: Record<string, string> = {
    queued: "CONNECTING",
    initiated: "CONNECTING",
    ringing: "RINGING",
    "in-progress": "IN_PROGRESS",
    answered: "IN_PROGRESS",
    completed: "COMPLETED",
    failed: "FAILED",
    "no-answer": "NO_ANSWER",
    busy: "BUSY",
    canceled: "CANCELED",
  };
  const next = mapped[event] || current;
  if (isTerminal(next)) return next;
  const rank: Record<string, number> = {
    WAITING: 0,
    CONNECTING: 1,
    RINGING: 2,
    IN_PROGRESS: 3,
  };
  return (rank[next] ?? 0) >= (rank[current] ?? 0) ? next : current;
}
