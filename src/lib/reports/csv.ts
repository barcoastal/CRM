import type { ReportResult } from "./runner";

/** Quote all cells and neutralize spreadsheet formulas in text values. */
export function reportCsv(result: ReportResult): string {
  const cell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (typeof value === "string" && /^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [result.columns.map(c => cell(c.label)).join(","), ...result.rows.map(row => result.columns.map(c => cell(row[c.key])).join(","))].join("\r\n");
}
