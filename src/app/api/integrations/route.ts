import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createIntegrationCredentialSchema } from "@/lib/validations/integration-credential";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Integration.Manage");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const where: Record<string, unknown> = {};
  if (provider) where.provider = provider;
  const items = await prisma.integrationCredential.findMany({
    where, orderBy: [{ provider: "asc" }, { name: "asc" }],
  });
  // Redact secrets — return only top-level config keys to avoid leaking auth tokens
  const sanitized = items.map((c) => ({
    ...c,
    config: maskConfig(c.config),
  }));
  return NextResponse.json({ items: sanitized });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Integration.Manage");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createIntegrationCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const cred = await prisma.integrationCredential.create({
    data: {
      provider: parsed.data.provider,
      name: parsed.data.name,
      isActive: parsed.data.isActive,
      scopes: parsed.data.scopes ?? null,
      config: parsed.data.config as object,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json({ ...cred, config: maskConfig(cred.config) }, { status: 201 });
}

function maskConfig(cfg: unknown): Record<string, unknown> {
  if (!cfg || typeof cfg !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg as Record<string, unknown>)) {
    if (typeof v === "string" && /token|secret|key|password/i.test(k)) {
      out[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : "•••";
    } else {
      out[k] = v;
    }
  }
  return out;
}
