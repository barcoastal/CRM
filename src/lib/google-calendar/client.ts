import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
];

type StoredGoogleConfig = {
  refreshTokenEnc: string;
  calendarId: string;
  email?: string;
};

function oauthEnv() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Calendar OAuth environment variables are not configured");
  }
  return { clientId, clientSecret, redirectUri };
}

function stateKey(): string {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is required for Google OAuth state");
  return value;
}

export function createGoogleOAuthState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 10 * 60_000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyGoogleOAuthState(state: string): { userId: string } | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; expiresAt: number };
    return parsed.userId && parsed.expiresAt > Date.now() ? { userId: parsed.userId } : null;
  } catch { return null; }
}

export function googleAuthorizationUrl(userId: string): string {
  const env = oauthEnv();
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    state: createGoogleOAuthState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ refreshToken: string; scope: string }> {
  const env = oauthEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: env.clientId, client_secret: env.clientSecret,
      redirect_uri: env.redirectUri, grant_type: "authorization_code",
    }),
  });
  const data = await response.json().catch(() => ({})) as { refresh_token?: string; scope?: string; error_description?: string };
  if (!response.ok || !data.refresh_token) throw new Error(data.error_description ?? "Google did not return a refresh token");
  return { refreshToken: data.refresh_token, scope: data.scope ?? GOOGLE_CALENDAR_SCOPES.join(" ") };
}

export async function saveGoogleConnection(args: { refreshToken: string; scope: string; userId: string }) {
  return prisma.integrationCredential.upsert({
    where: { provider_name: { provider: "GOOGLE_CALENDAR", name: "Primary booking calendar" } },
    create: {
      provider: "GOOGLE_CALENDAR", name: "Primary booking calendar", isActive: true,
      scopes: args.scope, createdById: args.userId,
      config: { refreshTokenEnc: encryptSecret(args.refreshToken), calendarId: "primary" },
    },
    update: {
      isActive: true, scopes: args.scope, rotatedAt: new Date(), createdById: args.userId,
      config: { refreshTokenEnc: encryptSecret(args.refreshToken), calendarId: "primary" },
    },
  });
}

async function getConfig(): Promise<StoredGoogleConfig> {
  const credential = await prisma.integrationCredential.findFirst({
    where: { provider: "GOOGLE_CALENDAR", isActive: true }, orderBy: { updatedAt: "desc" },
  });
  if (!credential) throw new Error("Google Calendar is not connected");
  const config = credential.config as unknown as Partial<StoredGoogleConfig>;
  if (!config.refreshTokenEnc) throw new Error("Google Calendar refresh token is missing");
  return { refreshTokenEnc: config.refreshTokenEnc, calendarId: config.calendarId ?? "primary", email: config.email };
}

async function accessToken(config: StoredGoogleConfig): Promise<string> {
  const env = oauthEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId, client_secret: env.clientSecret,
      refresh_token: decryptSecret(config.refreshTokenEnc), grant_type: "refresh_token",
    }),
  });
  const data = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? "Unable to refresh Google access token");
  return data.access_token;
}

export async function isGoogleCalendarFree(start: Date, end: Date): Promise<boolean> {
  const config = await getConfig();
  const token = await accessToken(config);
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: config.calendarId }] }),
  });
  const data = await response.json().catch(() => ({})) as { calendars?: Record<string, { busy?: unknown[] }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "Google free/busy lookup failed");
  return (data.calendars?.[config.calendarId]?.busy?.length ?? 0) === 0;
}

export async function createGoogleCalendarEvent(args: {
  summary: string; description: string; start: Date; end: Date; attendeeEmail?: string | null;
}): Promise<{ id: string; htmlLink?: string; meetLink?: string }> {
  const config = await getConfig();
  const token = await accessToken(config);
  const requestId = crypto.randomUUID();
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: args.summary, description: args.description,
      start: { dateTime: args.start.toISOString() }, end: { dateTime: args.end.toISOString() },
      attendees: args.attendeeEmail ? [{ email: args.attendeeEmail }] : undefined,
      conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
  });
  const data = await response.json().catch(() => ({})) as {
    id?: string; htmlLink?: string; hangoutLink?: string; error?: { message?: string };
  };
  if (!response.ok || !data.id) throw new Error(data.error?.message ?? "Google event creation failed");
  return { id: data.id, htmlLink: data.htmlLink, meetLink: data.hangoutLink };
}
