import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Helper for public webhook routes: validate a shared secret, log the request,
 * and run a handler. Always logs the WebhookEvent regardless of validity.
 */
export async function handleWebhook(args: {
  req: NextRequest;
  source: string;
  endpoint: string;
  secretEnvVar: string;
  process: (payload: unknown) => Promise<{ status: "PROCESSED" | "IGNORED" | "FAILED"; note?: string }>;
}): Promise<NextResponse> {
  const expected = process.env[args.secretEnvVar];
  const provided = args.req.headers.get("x-webhook-secret");
  const signatureValid = !!expected && provided === expected;

  let payload: unknown = null;
  try { payload = await args.req.json(); } catch { /* keep null */ }

  const headerEntries = Array.from(args.req.headers.entries()).filter(
    ([k]) => !["authorization", "cookie", "x-webhook-secret"].includes(k.toLowerCase()),
  );
  const headers = Object.fromEntries(headerEntries);
  const ipAddress = args.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  if (!signatureValid) {
    await prisma.webhookEvent.create({
      data: {
        source: args.source, endpoint: args.endpoint,
        ipAddress,
        headers: headers as object,
        ...(payload ? { payload: payload as object } : {}),
        signatureValid: false,
        status: "IGNORED",
        resultNote: expected ? "Invalid x-webhook-secret" : `${args.secretEnvVar} not configured`,
      },
    }).catch(() => null);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validated — process
  let result: { status: "PROCESSED" | "IGNORED" | "FAILED"; note?: string };
  try {
    result = await args.process(payload);
  } catch (e) {
    result = { status: "FAILED", note: e instanceof Error ? e.message : String(e) };
  }

  await prisma.webhookEvent.create({
    data: {
      source: args.source, endpoint: args.endpoint,
      ipAddress,
      headers: headers as object,
      ...(payload ? { payload: payload as object } : {}),
      signatureValid: true,
      status: result.status,
      resultNote: result.note ?? null,
      processedAt: new Date(),
    },
  }).catch(() => null);

  if (result.status === "FAILED") {
    return NextResponse.json({ error: result.note ?? "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: result.status, note: result.note ?? null });
}
