import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POSTBACK_EVENTS } from "@/lib/marketing/postback";
import { EditPostbackForm } from "./form";
import { RetryButton } from "./retry-button";

export default async function PostbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await params;

  const [endpoint, logs] = await Promise.all([
    prisma.marketingPostbackEndpoint.findUnique({ where: { id } }),
    prisma.marketingPostbackLog.findMany({
      where: { endpointId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!endpoint) notFound();

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            {endpoint.name}
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
            <Link href="/marketing/postbacks" className="text-[#3052ff]">Postbacks</Link> / {endpoint.name}
          </p>
        </div>
        <span
          className={`inline-flex px-3 py-1 rounded-full text-[12px] font-semibold ${
            endpoint.isActive
              ? "bg-[rgba(26,125,55,0.1)] text-[#1a7d37]"
              : "bg-[#f2f3ff] text-[#444656]"
          }`}
        >
          {endpoint.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <EditPostbackForm
        endpoint={{
          id: endpoint.id,
          name: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          authHeaderKey: endpoint.authHeaderKey,
          authHeaderValue: endpoint.authHeaderValue,
          payloadTemplate: endpoint.payloadTemplate,
          events: endpoint.events,
          isActive: endpoint.isActive,
          retryOnFail: endpoint.retryOnFail,
          maxAttempts: endpoint.maxAttempts,
        }}
        availableEvents={[...POSTBACK_EVENTS]}
      />

      <section className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="px-5 py-4 border-b border-[#f2f3ff]">
          <h2 className="text-[14px] font-bold text-[#131b2e]">Recent Sends (last 50)</h2>
          <p className="text-[12px] text-[#444656] mt-0.5">Every postback fired to this endpoint.</p>
        </div>
        {logs.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#444656]">
            No postbacks fired yet. Subscribe to events above and trigger them in the CRM.
          </div>
        ) : (
          <LogTable logs={logs} endpointId={endpoint.id} />
        )}
      </section>
    </div>
  );
}

type LogRow = {
  id: string;
  event: string;
  entityType: string | null;
  entityId: string | null;
  requestBody: unknown;
  responseBody: unknown;
  responseStatus: number | null;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  createdAt: Date;
};

function LogTable({ logs, endpointId }: { logs: LogRow[]; endpointId: string }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {["Time", "Event", "Status", "HTTP", "Attempts", "Entity", "Action"].map((h) => (
            <th
              key={h}
              className="text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] px-4 py-3 bg-[#f2f3ff]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {logs.map((l, idx) => (
          <PostbackLogRow key={l.id} log={l} endpointId={endpointId} idx={idx} />
        ))}
      </tbody>
    </table>
  );
}

function PostbackLogRow({ log, endpointId, idx }: { log: LogRow; endpointId: string; idx: number }) {
  const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]";
  return (
    <>
      <tr>
        <td className={`px-4 py-3 text-[12px] text-[#444656] ${rowBg}`}>
          {new Date(log.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
        </td>
        <td className={`px-4 py-3 text-[12px] font-mono ${rowBg}`}>
          <span className="px-1.5 py-0.5 rounded bg-[#f2f3ff] text-[#3052ff]">{log.event}</span>
        </td>
        <td className={`px-4 py-3 ${rowBg}`}>
          <PostbackStatusBadge status={log.status} />
        </td>
        <td className={`px-4 py-3 text-[12px] font-mono ${rowBg}`}>
          {log.responseStatus ? (
            <span className={log.responseStatus >= 200 && log.responseStatus < 300 ? "text-[#1a7d37]" : "text-[#942b00]"}>
              {log.responseStatus}
            </span>
          ) : (
            <span className="text-[#747474]">--</span>
          )}
        </td>
        <td className={`px-4 py-3 text-[12px] text-[#444656] ${rowBg}`}>{log.attempts}</td>
        <td className={`px-4 py-3 text-[12px] ${rowBg}`}>
          {log.entityType && log.entityId ? (
            <Link
              href={`/${log.entityType.toLowerCase()}s/${log.entityId}`}
              className="text-[#3052ff] font-mono"
            >
              {log.entityType.toLowerCase()}/{log.entityId.slice(0, 8)}
            </Link>
          ) : (
            <span className="text-[#747474]">--</span>
          )}
        </td>
        <td className={`px-4 py-3 ${rowBg}`}>
          {log.status === "failed" && <RetryButton endpointId={endpointId} logId={log.id} />}
        </td>
      </tr>
      {(log.lastError || log.responseBody || log.requestBody) && (
        <tr>
          <td colSpan={7} className={`px-4 pb-3 ${rowBg}`}>
            <details className="text-[11px]">
              <summary className="cursor-pointer text-[#3052ff] font-semibold">Request / Response</summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-[#747474] font-semibold mb-1">Request</div>
                  <pre className="bg-[#f8f8fb] p-2 rounded font-mono text-[10px] overflow-auto max-h-[160px]">
                    {JSON.stringify(log.requestBody, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[#747474] font-semibold mb-1">Response</div>
                  <pre className="bg-[#f8f8fb] p-2 rounded font-mono text-[10px] overflow-auto max-h-[160px]">
                    {log.lastError ? `Error: ${log.lastError}\n\n` : ""}
                    {log.responseBody ? JSON.stringify(log.responseBody, null, 2) : ""}
                  </pre>
                </div>
              </div>
            </details>
          </td>
        </tr>
      )}
    </>
  );
}

function PostbackStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-[rgba(26,125,55,0.1)] text-[#1a7d37]",
    queued: "bg-[#f2f3ff] text-[#444656]",
    failed: "bg-[rgba(148,43,0,0.12)] text-[#942b00]",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${map[status] ?? map.queued}`}>
      {status}
    </span>
  );
}
