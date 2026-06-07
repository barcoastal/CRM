import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditSourceForm } from "./form";

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com";
}

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await params;

  const [source, users, queues, logs] = await Promise.all([
    prisma.marketingSource.findUnique({
      where: { id },
      include: {
        defaultOwner: { select: { id: true, name: true, email: true } },
        defaultQueue: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({
      where: { type: "QUEUE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.marketingInboundLog.findMany({
      where: { sourceId: id },
      orderBy: { receivedAt: "desc" },
      take: 50,
    }),
  ]);

  if (!source) notFound();

  const webhookUrl = `${baseUrl()}/api/marketing/inbound/${source.slug}`;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            {source.name}
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
            <Link href="/marketing/sources" className="text-[#3052ff]">Sources</Link> / {source.name}
          </p>
        </div>
        <span
          className={`inline-flex px-3 py-1 rounded-full text-[12px] font-semibold ${
            source.isActive
              ? "bg-[rgba(26,125,55,0.1)] text-[#1a7d37]"
              : "bg-[#f2f3ff] text-[#444656]"
          }`}
        >
          {source.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <EditSourceForm
        source={{
          id: source.id,
          name: source.name,
          slug: source.slug,
          isActive: source.isActive,
          apiKey: source.apiKey,
          fieldMapping: source.fieldMapping as Record<string, string>,
          defaultOwnerId: source.defaultOwnerId,
          defaultQueueId: source.defaultQueueId,
          leadSource: source.leadSource,
          dedupeBy: source.dedupeBy,
          requiredFields: source.requiredFields,
        }}
        webhookUrl={webhookUrl}
        users={users}
        queues={queues}
      />

      <section className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="px-5 py-4 border-b border-[#f2f3ff]">
          <h2 className="text-[14px] font-bold text-[#131b2e]">Recent Inbound (last 50)</h2>
          <p className="text-[12px] text-[#444656] mt-0.5">Every POST to this webhook is logged here.</p>
        </div>
        {logs.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#444656]">
            No inbound payloads yet. Send a test or paste the URL into your source.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Time", "Status", "Lead", "Error", "IP"].map((h) => (
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
                <tr key={l.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
                  <td className="px-4 py-3 text-[12px] text-[#444656]">
                    {new Date(l.receivedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    {l.leadId ? (
                      <Link href={`/leads/${l.leadId}`} className="text-[#3052ff] font-mono">
                        {l.leadId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-[#706e6b]">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#942b00] truncate max-w-[300px]">
                    {l.errorMessage ?? ""}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#706e6b] font-mono">{l.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    created: "bg-[rgba(26,125,55,0.1)] text-[#1a7d37]",
    duplicate: "bg-[#f2f3ff] text-[#444656]",
    validation_failed: "bg-[rgba(180,140,0,0.1)] text-[#8a6d00]",
    error: "bg-[rgba(148,43,0,0.12)] text-[#942b00]",
    received: "bg-[#f2f3ff] text-[#444656]",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${map[status] ?? map.received}`}>
      {status}
    </span>
  );
}
