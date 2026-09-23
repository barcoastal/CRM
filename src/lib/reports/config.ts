import type { ReportConfig, ReportFilter, ReportSummarize } from "./runner";
import type { ReportFormula } from "./formulas";
import type { ReportOptions } from "./advanced";
export function savedReportConfig(report: { objectType: string; columns: unknown; filters: unknown; formulas?: unknown; options?: unknown; groupBy?: string | null; sortBy?: string | null; sortDir?: string; summarize: unknown; rowLimit: number }): ReportConfig {
  return { objectType: report.objectType, columns: report.columns as string[], filters: report.filters as ReportFilter[], formulas: (report.formulas ?? []) as ReportFormula[], options: (report.options ?? {}) as ReportOptions, groupBy: report.groupBy, sortBy: report.sortBy, sortDir: report.sortDir === "desc" ? "desc" : "asc", summarize: report.summarize as ReportSummarize[], rowLimit: report.rowLimit };
}
