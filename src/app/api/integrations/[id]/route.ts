import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateIntegrationCredentialSchema } from "@/lib/validations/integration-credential";
import { maskConfig } from "@/lib/integrations/mask-config";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Integration.Manage");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const cred = await prisma.integrationCredential.findUnique({ where: { id } });
  if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Never return raw secrets; the list route masks too. Secrets are write-only.
  return NextResponse.json({ ...cred, config: maskConfig(cred.config) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Integration.Manage");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateIntegrationCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.rotatedAt) data.rotatedAt = new Date(parsed.data.rotatedAt);
  if (parsed.data.config) data.config = parsed.data.config as object;
  const cred = await prisma.integrationCredential.update({ where: { id }, data });
  return NextResponse.json({ ...cred, config: maskConfig(cred.config) });
}
