import fs from "node:fs";
import { execFile } from "node:child_process";

const TRANSIENT = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2028", "P2034", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "57P01", "40001", "40P01"]);
export function errorCode(error: unknown): string {
  const e = error as { code?: unknown; message?: unknown; meta?: { code?: unknown } };
  if (e?.code === "P2010" && typeof e.meta?.code === "string") return e.meta.code;
  if (typeof e?.message === "string" && /^(Query read timeout|Connection terminated unexpectedly)$/.test(e.message)) return "ETIMEDOUT";
  return typeof e?.code === "string" ? e.code : "UNKNOWN";
}
export async function retry<T>(run: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await run(); }
    catch (error) {
      if (attempt >= attempts || !TRANSIENT.has(errorCode(error))) throw error;
      console.warn(`Transient sync failure (${errorCode(error)}); retry ${attempt}/${attempts - 1}`);
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
}

/** Finish all in-flight writes before returning an error. Upserts are safe to retry. */
export async function writeBatch<T>(rows: T[], write: (row: T) => Promise<unknown>, concurrency = 5) {
  for (let i = 0; i < rows.length; i += concurrency) {
    const results = await Promise.allSettled(rows.slice(i, i + concurrency).map(row => retry(() => write(row))));
    const failures = results.filter(r => r.status === "rejected");
    if (failures.length) throw new Error(`Sync writes failed (${failures.map(r => errorCode(r.reason)).join(", ")}); record values omitted`);
  }
}

export function addPredicate(soql: string, predicate: string) {
  // Preserve any existing OR expression inside the new outer AND.
  const at = soql.search(/ WHERE /i);
  return at < 0 ? `${soql} WHERE ${predicate}` : `${soql.slice(0, at)} WHERE (${predicate}) AND (${soql.slice(at + 7)})`;
}
/** These CRM records require a parent. Source rows with no parent are outside
 * this mapping; a populated parent missing from CRM must still fail/retry. */
export function requireSourceParent(entity: string, soql: string) {
  const field: Record<string, string> = { opportunity: "AccountId", programplan: "Client__c", draft: "Program_Plan__c", debt: "Opportunity__c", fee: "Program_Plan__c", paymentsummary: "Client__c" };
  return field[entity] ? addPredicate(soql, `${field[entity]} != null`) : soql;
}
export function utcTimestamp(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error("Invalid sync timestamp");
  return date.toISOString();
}
export function pageQuery(soql: string, after: string | null, size = 500) {
  if (after && !/^[a-zA-Z0-9]{15,18}$/.test(after)) throw new Error("Invalid source cursor");
  return `${after ? addPredicate(soql, `Id > '${after}'`) : soql} ORDER BY Id ASC LIMIT ${size}`;
}
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function fieldValue(record: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null, record);
}

async function cliQuery(soql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    execFile("sf", ["data", "query", "--target-org", "coastal", "--query", soql, "--json"],
      { timeout: 120_000, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, SF_DISABLE_TELEMETRY: "true" } }, (error, stdout) => {
        if (error) { reject(Object.assign(new Error("Salesforce query failed; source response omitted"), { code: "ETIMEDOUT" })); return; }
        try {
          const data = JSON.parse(stdout);
          if (data.status !== 0 || !Array.isArray(data.result?.records) || data.result.done === false) throw new Error("Incomplete Salesforce query result");
          resolve(data.result.records);
        } catch { reject(new Error("Invalid Salesforce query result; source response omitted")); }
      });
  });
}

/** Incremental exports use small synchronous REST queries, avoiding a Bulk job
 * that can spend the entire nightly timeout waiting to be created. */
export async function incrementalCsv(soql: string, outPath: string,
  query: (q: string) => Promise<Record<string, unknown>[]> = process.env.SF_AUTH_URL
    ? async q => (await import("./bulk-export")).querySourceRecords(q) : cliQuery,
  pageSize = process.env.SF_AUTH_URL ? 500 : 1000) {
  const fields = /^SELECT (.*?) FROM /i.exec(soql)?.[1].split(",").map(s => s.trim());
  if (!fields?.includes("Id")) throw new Error("Sync query must select Id");
  const temporary = `${outPath}.${process.pid}.partial`;
  fs.writeFileSync(temporary, fields.map(csvCell).join(",") + "\n", { mode: 0o600 });
  let after: string | null = null;
  let count = 0;
  try {
    for (;;) {
      const rows = await retry(() => query(pageQuery(soql, after, pageSize)));
      if (rows.length > pageSize) throw new Error("Source page exceeded its limit");
      const previous: string | null = after;
      const pageIds = new Set<string>();
      for (const row of rows) {
        if (typeof row.Id !== "string" || !/^[a-zA-Z0-9]{15,18}$/.test(row.Id) || (row.Id === previous || pageIds.has(row.Id))) throw new Error("Source cursor did not advance");
        pageIds.add(row.Id);
        after = row.Id;
      }
      if (rows.length) fs.appendFileSync(temporary, rows.map(r => fields.map(f => csvCell(fieldValue(r, f))).join(",")).join("\n") + "\n");
      count += rows.length;
      console.log(`Source export: ${count} records`);
      if (rows.length < pageSize) break;
    }
    fs.renameSync(temporary, outPath);
    return count;
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

export type Checkpoint = { completedThrough: string; completedAt: string };
export function nextWindow(checkpoint: Checkpoint | null, now: Date, initialSince?: string) {
  const since = initialSince ? utcTimestamp(initialSince) : checkpoint
    ? new Date(Date.parse(checkpoint.completedThrough) - 5 * 60_000).toISOString()
    : new Date(now.getTime() - 2 * 86400_000).toISOString();
  return { since, until: now.toISOString() };
}
