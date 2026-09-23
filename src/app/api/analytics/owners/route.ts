import { analyticsApiAccess } from "@/lib/analytics-access";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const gate = await analyticsApiAccess("Dashboards.View");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const items = await prisma.user.findMany({ where: { isActive: true, ...(access.isAdmin ? {} : { id: { in: access.ownerIds } }) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return Response.json({ items });
}
