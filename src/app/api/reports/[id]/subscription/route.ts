import { hasPermission } from "@/lib/permissions";
import { NextRequest } from "next/server";
import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { prisma } from "@/lib/prisma";
import { reportScheduleSchema, nextReportRun } from "@/lib/reports/schedule";
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, ctx: Context) {
  const gate = await analyticsApiAccess("Reports.View");
  if ("response" in gate) return gate.response;
  const { id } = await ctx.params;
  const subscription = await prisma.reportSubscription.findUnique({ where: { reportId_userId: { reportId: id, userId: gate.access.userId } }, include: { deliveries: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, lastError: true, sentAt: true } } } });
  return Response.json({ subscription });
}
export async function PUT(req: NextRequest, ctx: Context) {
  const gate = await analyticsApiAccess("Reports.View");
  if ("response" in gate) return gate.response;
  const { id } = await ctx.params;
  const report = await prisma.report.findFirst({ where: { id, AND: [definitionScope(gate.access)] } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  const parsed = reportScheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid frequency, hour and weekday." }, { status: 400 });
  if (parsed.data.snapshotFormat === "csv" && !gate.access.isAdmin && !hasPermission(gate.access.permissions, "Reports.Export")) return Response.json({ error: "Report export permission is required for snapshots." }, { status: 403 });
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "Scheduled email is unavailable until email delivery is configured." }, { status: 503 });
  const data = { ...parsed.data, nextRunAt: nextReportRun(parsed.data) };
  const subscription = await prisma.reportSubscription.upsert({ where: { reportId_userId: { reportId: id, userId: gate.access.userId } }, create: { ...data, reportId: id, userId: gate.access.userId }, update: data });
  return Response.json({ subscription });
}
export async function DELETE(_req: NextRequest, ctx: Context) {
  const gate = await analyticsApiAccess("Reports.View");
  if ("response" in gate) return gate.response;
  const { id } = await ctx.params;
  await prisma.reportSubscription.deleteMany({ where: { reportId: id, userId: gate.access.userId } });
  return Response.json({ ok: true });
}
