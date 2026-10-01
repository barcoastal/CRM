import { prisma } from "@/lib/prisma";
import { pilotConfigSchema, secretMatches } from "./policy";
export async function authenticateSalesforcePilot(headers: Headers) {
  const orgId = headers.get("x-salesforce-org-id") ?? "";
  const secret = headers.get("x-coastal-esign-key") ?? "";
  if (!/^00D[a-zA-Z0-9]{15}$/.test(orgId) || !/^[a-f0-9]{64}$/.test(secret))
    return null;
  const row = await prisma.integrationCredential.findUnique({
    where: {
      provider_name: { provider: "SALESFORCE_ESIGN_SANDBOX", name: orgId },
    },
  });
  const config = pilotConfigSchema.safeParse(row?.config);
  if (
    !row?.isActive ||
    !config.success ||
    config.data.orgId !== orgId ||
    !secretMatches(secret, config.data.secretHash)
  )
    return null;
  return config.data;
}
