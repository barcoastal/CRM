import { prisma } from "@/lib/prisma";

/**
 * All postback event keys the CRM can emit. Used for the multi-select on the
 * Postback Endpoint form and for the firePostbackEvent dispatcher.
 */
export const POSTBACK_EVENTS = [
  "lead.created",
  "lead.disposition_changed",
  "lead.converted",
  "opportunity.created",
  "opportunity.stage_changed",
  "opportunity.closed_won",
  "opportunity.closed_lost",
] as const;

export type PostbackEvent = (typeof POSTBACK_EVENTS)[number];

/**
 * Tiny mustache-style template renderer. Supports {{a.b.c}} dot paths.
 * Missing values render as empty string.
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let cur: unknown = data;
    for (const p of parts) {
      if (cur == null) return "";
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur == null ? "" : String(cur);
  });
}

function backoffMs(attempt: number): number {
  // 1s, 4s, 16s, ... (exponential, base 4)
  return Math.min(60000, Math.pow(4, attempt - 1) * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Send a single postback to one endpoint, with retries. Used both by
 * firePostbackEvent and by the manual retry route.
 */
export async function sendPostback(opts: {
  endpointId: string;
  event: string;
  entityType?: string | null;
  entityId?: string | null;
  data: Record<string, unknown>;
  existingLogId?: string | null;
}): Promise<{ logId: string; status: string }> {
  const ep = await prisma.marketingPostbackEndpoint.findUnique({
    where: { id: opts.endpointId },
  });
  if (!ep) throw new Error(`Endpoint ${opts.endpointId} not found`);

  // Build body
  let renderedBody: unknown = opts.data;
  if (ep.payloadTemplate && ep.payloadTemplate.trim()) {
    const rendered = renderTemplate(ep.payloadTemplate, opts.data);
    try {
      renderedBody = JSON.parse(rendered);
    } catch {
      // not JSON, send as raw string
      renderedBody = rendered;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (ep.authHeaderKey && ep.authHeaderValue) {
    headers[ep.authHeaderKey] = ep.authHeaderValue;
  }

  const method = (ep.method || "POST").toUpperCase();

  let log = opts.existingLogId
    ? await prisma.marketingPostbackLog.findUnique({ where: { id: opts.existingLogId } })
    : null;

  if (!log) {
    log = await prisma.marketingPostbackLog.create({
      data: {
        endpointId: ep.id,
        event: opts.event,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        requestBody: renderedBody as never,
        status: "queued",
        attempts: 0,
      },
    });
  }

  const maxAttempts = ep.retryOnFail ? Math.max(1, ep.maxAttempts) : 1;
  let attempts = log.attempts;
  let lastError: string | null = null;
  let lastStatus: number | null = null;
  let lastResponseBody: unknown = null;
  let success = false;

  while (attempts < maxAttempts && !success) {
    attempts += 1;
    if (attempts > 1) {
      await sleep(backoffMs(attempts - 1));
    }
    try {
      const init: RequestInit = { method, headers };
      if (method !== "GET" && method !== "HEAD") {
        init.body =
          typeof renderedBody === "string"
            ? renderedBody
            : JSON.stringify(renderedBody);
      }
      const res = await fetch(ep.url, init);
      lastStatus = res.status;
      const text = await res.text();
      try {
        lastResponseBody = JSON.parse(text);
      } catch {
        lastResponseBody = text;
      }
      if (res.ok) {
        success = true;
      } else {
        lastError = `HTTP ${res.status}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const final = await prisma.marketingPostbackLog.update({
    where: { id: log.id },
    data: {
      attempts,
      status: success ? "sent" : "failed",
      responseStatus: lastStatus,
      responseBody: (lastResponseBody as never) ?? null,
      lastError: success ? null : lastError,
      sentAt: success ? new Date() : null,
    },
  });

  return { logId: final.id, status: final.status };
}

/**
 * Fire an event to all active endpoints subscribed to it.
 * Never throws — callers don't need to await or catch.
 */
export async function firePostbackEvent(opts: {
  event: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const endpoints = await prisma.marketingPostbackEndpoint.findMany({
      where: { isActive: true, events: { has: opts.event } },
    });
    if (endpoints.length === 0) return;
    const results = await Promise.allSettled(
      endpoints.map((ep) =>
        sendPostback({
          endpointId: ep.id,
          event: opts.event,
          entityType: opts.entityType,
          entityId: opts.entityId,
          data: opts.data,
        }),
      ),
    );
    // Swallow rejections — logs already track failures.
    void results;
  } catch {
    // Never throw from firePostbackEvent.
  }
}
