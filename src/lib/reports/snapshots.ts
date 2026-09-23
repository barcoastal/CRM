import { reportCsv } from "./csv";
import type { ReportConfig, ReportResult } from "./runner";
import { runReportWithAccess } from "./runner";
import { savedReportConfig } from "./config";
import { analyticsAccessForUser } from "@/lib/analytics-access";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { redactSsn } from "@/lib/ssn-privacy";
export type SavedSnapshot = { config: ReportConfig; result: ReportResult };
export function summaryCsv(result: ReportResult): string {
  const keys = [...new Set(["_count", ...Object.keys(result.totals ?? {})])];
  return reportCsv({ columns: [{ key: "group", label: "Group" }, ...keys.map(key => ({ key, label: key }))], rows: [{ group: "Grand total", ...result.totals }, ...(result.groups ?? []).map(g => ({ group: g.key, ...g.summary }))], rowCount: 1 + (result.groups?.length ?? 0) });
}
export async function createReportSnapshot(reportId: string, userId: string): Promise<SavedSnapshot> {
  const access = await analyticsAccessForUser(userId);
  if (!access.isAdmin && !hasPermission(access.permissions, "Reports.Export")) throw new Error("Report export permission was removed");
  const report = await prisma.report.findFirst({ where: { id: reportId, ...(access.isAdmin ? {} : { OR: [{ isShared: true }, { createdById: userId }] }) } });
  if (!report) throw new Error("Report access was removed");
  const config = savedReportConfig(report);
  const result = await runReportWithAccess(config, access);
  if ("error" in result) throw new Error(result.error);
  return { config, result: redactSsn(result) as ReportResult };
}
export async function canReadSnapshot(snapshot: SavedSnapshot, userId: string): Promise<boolean> {
  const access = await analyticsAccessForUser(userId);
  if (!access.isAdmin && !hasPermission(access.permissions, "Reports.Export")) return false;
  const current = await runReportWithAccess(snapshot.config, access);
  return !("error" in current) && !!snapshot.result.scopeHash && current.scopeHash === snapshot.result.scopeHash;
}
export function snapshotAttachments(snapshot: SavedSnapshot) {
  return [
    { filename: "report-summary.csv", content: Buffer.from(summaryCsv(snapshot.result), "utf8").toString("base64") },
    { filename: "report-details.csv", content: Buffer.from(reportCsv(snapshot.result), "utf8").toString("base64") },
  ];
}
