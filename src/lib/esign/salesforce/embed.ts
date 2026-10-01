import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { pilotConfigSchema, sourceSchema, type PilotConfig } from "./policy";

const lifetime = 30 * 60;
export function issueEmbedToken(
  config: PilotConfig,
  packetId: string,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify({
      org: config.orgId,
      packet: packetId,
      user: config.salesforceUserId,
      exp: Math.floor(now / 1000) + lifetime,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", config.secretHash)
    .update("coastal-embed-v1:" + payload)
    .digest("base64url");
  return payload + "." + signature;
}
export function verifyEmbedToken(
  token: string,
  config: PilotConfig,
  packetId: string,
  now = Date.now(),
) {
  try {
    if (token.length > 1500) return false;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", config.secretHash)
      .update("coastal-embed-v1:" + payload)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(expected, actual))
      return false;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    const seconds = Math.floor(now / 1000);
    return (
      claims.org === config.orgId &&
      claims.user === config.salesforceUserId &&
      claims.packet === packetId &&
      Number.isInteger(claims.exp) &&
      claims.exp > seconds &&
      claims.exp <= seconds + lifetime
    );
  } catch {
    return false;
  }
}
// This capability is accepted only by single-packet routes, never by general CRM APIs.
export async function requirePacketAuth(
  req: Request,
  id: string,
  permission: string,
) {
  const header = req.headers.get("authorization");
  if (!header) return requireAuthOrRespond(permission);
  const denied = () => ({
    response: NextResponse.json(
      { error: "Salesforce session expired. Close and reopen Coastal Sign." },
      { status: 401 },
    ),
  });
  if (!header.startsWith("Bearer ")) return denied();
  const packet = await prisma.signingPacket.findUnique({ where: { id } });
  const source = sourceSchema.safeParse(packet?.salesforceSource);
  if (!packet || !source.success) return denied();
  const row = await prisma.integrationCredential.findUnique({
    where: {
      provider_name: {
        provider: "SALESFORCE_ESIGN_SANDBOX",
        name: source.data.orgId,
      },
    },
  });
  const config = pilotConfigSchema.safeParse(row?.config);
  if (
    !row?.isActive ||
    !config.success ||
    config.data.opportunityId !== source.data.opportunityId ||
    config.data.senderUserId !== packet.createdById ||
    !verifyEmbedToken(header.slice(7), config.data, id)
  )
    return denied();
  return { session: { userId: config.data.senderUserId } };
}
