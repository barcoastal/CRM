import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SP = { view?: string };

export default async function MarketingLogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await auth();
  const sp = await searchParams;
  const view = sp.view === "outbound" ? "outbound" : "inbound";

  const [inbound, outbound] = await Promise.all([
    view === "inbound"
      ? prisma.marketingInboundLog.findMany({
          orderBy: { receivedAt: "desc" },
          take: 100,
          include: { source: { select: { name: true, id: true } } },
        })
      : Promise.resolve([] as never[]),
    view === "outbound"
      ? prisma.marketingPostbackLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { endpoint: { select: { name: true, id: true } } },
        })
      : Promise.resolve([] as never[]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          Marketing Logs
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> / Logs
        </p>
      </div>

      <div className="flex gap-1 border-b border-[#c9c9c9]">
        <TabLink active={view === "inbound"} href="/marketing/logs?view=inbound">
          Inbound
        </TabLink>
        <TabLink active={view === "outbound"} href="/marketing/logs?view=outbound">
          Outbound
        </TabLink>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        {view === "inbound" ? <InboundTable rows={inbound} /> : <OutboundTable rows={outbound} />}
      </div>
    </div>
  );
}

function TabLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 ${
        active ? "border-[#3052ff] text-[#3052ff]" : "border-transparent text-[#444656] hover:text-[#131b2e]"
      }`}
    >
      {children}
    </Link>
  );
}

type InboundRow = {
  id: string;
  receivedAt: Date;
  status: string;
  errorMessage: string | null;
  leadId: string | null;
  rawPayload: unknown;
  source: { id: string; name: string };
};

function InboundTable({ rows }: { rows: InboundRow[] }) {
  if (rows.length === 0) {
    return <div className="px-5 py-10 text-center text-[13px] text-[#444656]">No inbound activity yet.</div>;
  }
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {["Time", "Source", "Status", "Lead", "Error", "Payload"].map((h) => (
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
        {rows.map((l, idx) => (
          <tr key={l.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
            <td className="px-4 py-3 text-[12px] text-[#444656]">
              {new Date(l.receivedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
            </td>
            <td className="px-4 py-3 text-[12px]">
              <Link href={`/marketing/sources/${l.source.id}`} className="text-[#3052ff] font-semibold">
                {l.source.name}
              </Link>
            </td>
            <td className="px-4 py-3">
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f2f3ff] text-[#444656]">
                {l.status}
              </span>
            </td>
            <td className="px-4 py-3 text-[12px]">
              {l.leadId ? (
                <Link href={`/leads/${l.leadId}`} className="text-[#3052ff] font-mono">
                  {l.leadId.slice(0, 8)}
                </Link>
              ) : (
                <span className="text-[#747474]">--</span>
              )}
            </td>
            <td className="px-4 py-3 text-[11px] text-[#942b00] truncate max-w-[300px]">{l.errorMessage ?? ""}</td>
            <td className="px-4 py-3">
              <details className="text-[11px]">
                <summary className="cursor-pointer text-[#3052ff]">View</summary>
                <pre className="mt-1 bg-[#f8f8fb] p-2 rounded font-mono text-[10px] overflow-auto max-h-[160px] max-w-[420px]">
                  {JSON.stringify(l.rawPayload, null, 2)}
                </pre>
              </details>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type OutboundRow = {
  id: string;
  createdAt: Date;
  event: string;
  status: string;
  responseStatus: number | null;
  attempts: number;
  lastError: string | null;
  requestBody: unknown;
  responseBody: unknown;
  endpoint: { id: string; name: string };
};

function OutboundTable({ rows }: { rows: OutboundRow[] }) {
  if (rows.length === 0) {
    return <div className="px-5 py-10 text-center text-[13px] text-[#444656]">No outbound activity yet.</div>;
  }
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {["Time", "Endpoint", "Event", "Status", "HTTP", "Attempts", "Detail"].map((h) => (
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
        {rows.map((l, idx) => (
          <tr key={l.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
            <td className="px-4 py-3 text-[12px] text-[#444656]">
              {new Date(l.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
            </td>
            <td className="px-4 py-3 text-[12px]">
              <Link href={`/marketing/postbacks/${l.endpoint.id}`} className="text-[#3052ff] font-semibold">
                {l.endpoint.name}
              </Link>
            </td>
            <td className="px-4 py-3 text-[12px] font-mono">
              <span className="px-1.5 py-0.5 rounded bg-[#f2f3ff] text-[#3052ff]">{l.event}</span>
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                  l.status === "sent"
                    ? "bg-[rgba(26,125,55,0.1)] text-[#1a7d37]"
                    : l.status === "failed"
                      ? "bg-[rgba(148,43,0,0.12)] text-[#942b00]"
                      : "bg-[#f2f3ff] text-[#444656]"
                }`}
              >
                {l.status}
              </span>
            </td>
            <td className="px-4 py-3 text-[12px] font-mono">
              {l.responseStatus ?? <span className="text-[#747474]">--</span>}
            </td>
            <td className="px-4 py-3 text-[12px] text-[#444656]">{l.attempts}</td>
            <td className="px-4 py-3">
              <details className="text-[11px]">
                <summary className="cursor-pointer text-[#3052ff]">View</summary>
                <div className="mt-1 grid grid-cols-2 gap-2 max-w-[520px]">
                  <pre className="bg-[#f8f8fb] p-2 rounded font-mono text-[10px] overflow-auto max-h-[140px]">
                    {JSON.stringify(l.requestBody, null, 2)}
                  </pre>
                  <pre className="bg-[#f8f8fb] p-2 rounded font-mono text-[10px] overflow-auto max-h-[140px]">
                    {l.lastError ? `Error: ${l.lastError}\n\n` : ""}
                    {l.responseBody ? JSON.stringify(l.responseBody, null, 2) : ""}
                  </pre>
                </div>
              </details>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
