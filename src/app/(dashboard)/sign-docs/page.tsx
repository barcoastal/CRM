import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  centerPage,
  centerSource,
  centerStatus,
  centerStatusWhere,
  centerWhere,
  CENTER_FILTERS,
} from "@/lib/esign/center";
import PdfTemplates from "@/components/esign/center/pdf-templates";
import ContractTemplates from "@/components/esign/center/contract-templates";
import { VICTORY_CREDITORS } from "@/lib/creditor-agreements";
import styles from "@/components/esign/center/center.module.css";

type Params = {
  tab?: string;
  status?: string;
  source?: string;
  q?: string;
  templateId?: string;
  sent?: string;
  page?: string;
  library?: string;
};
const tabs = [
  ["documents", "Documents"],
  ["drafts", "My drafts"],
  ["templates", "Templates"],
  ["rules", "Rules"],
  ["activity", "Activity"],
];
const date = (d: Date | null) =>
  d
    ? d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "—";
function href(params: Params) {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => !!v) as [string, string][],
  );
  return `/sign-docs?${q}`;
}

export default async function ESignCenter({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = await searchParams;
  const tab = tabs.some(([id]) => id === params.tab)
    ? params.tab!
    : "documents";
  return (
    <main className={styles.center}>
      <header className={styles.header}>
        <div>
          <h1>E-Sign Center</h1>
          <p>
            Send documents, manage templates, review rules, and follow every
            signature.
          </p>
        </div>
        <Link className={styles.primary} href="/envelopes/new">
          Send documents
        </Link>
      </header>
      <nav className={styles.tabs} aria-label="E-sign center">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={href({ tab: id })}
            aria-current={tab === id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "documents" && (
        <Documents params={params} userId={session.user.id} />
      )}
      {tab === "drafts" && <Drafts userId={session.user.id} params={params} />}
      {tab === "templates" && (
        <>
          <nav className={styles.tabs} aria-label="Template libraries">
            <Link
              href={href({ tab, library: "agreements" })}
              aria-current={params.library !== "pdf" ? "page" : undefined}
            >
              Agreement templates
            </Link>
            <Link
              href={href({ tab, library: "pdf" })}
              aria-current={params.library === "pdf" ? "page" : undefined}
            >
              PDF templates
            </Link>
          </nav>
          {params.library === "pdf" ? <PdfTemplates /> : <ContractTemplates />}
        </>
      )}
      {tab === "rules" && <Rules />}
      {tab === "activity" && <Activity params={params} />}
    </main>
  );
}
async function Documents({
  params,
  userId,
}: {
  params: Params;
  userId: string;
}) {
  const now = new Date();
  const where = centerWhere(params, now);
  const scope = centerWhere({ ...params, status: "all" }, now);
  const [total, all, pending, signed, expired, templates] = await Promise.all([
    prisma.envelope.count({ where }),
    prisma.envelope.count({ where: scope }),
    prisma.envelope.count({
      where: { AND: [scope, centerStatusWhere("pending", now)] },
    }),
    prisma.envelope.count({
      where: { AND: [scope, centerStatusWhere("signed", now)] },
    }),
    prisma.envelope.count({
      where: { AND: [scope, centerStatusWhere("expired", now)] },
    }),
    prisma.envelopeTemplate.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const page = Math.min(
    centerPage(params.page),
    Math.max(1, Math.ceil(total / 50)),
  );
  const rows = await prisma.envelope.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 50,
    take: 50,
    select: {
      id: true,
      documentName: true,
      signerName: true,
      signerEmail: true,
      status: true,
      expiresAt: true,
      sentAt: true,
      viewedAt: true,
      signedAt: true,
      completedAt: true,
      externalSource: true,
      packetId: true,
      createdBy: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      lead: { select: { id: true, contactName: true } },
    },
  });
  return (
    <>
      <div className={styles.stats}>
        {[
          [all, "All recipients", "all"],
          [pending, "Awaiting signature", "pending"],
          [signed, "Signed / completed", "signed"],
          [expired, "Expired", "expired"],
        ].map(([count, label, status]) => (
          <Link
            key={status}
            href={href({ ...params, page: undefined, status: String(status) })}
            className={styles.stat}
          >
            <strong>{Number(count).toLocaleString()}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <form className={styles.filters} action="/sign-docs">
        <input type="hidden" name="tab" value="documents" />
        <label>
          Search documents or recipients
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Document, name or email"
          />
        </label>
        <label>
          Status
          <select
            name="status"
            defaultValue={params.status?.toLowerCase() ?? "all"}
          >
            {CENTER_FILTERS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
            <option value="completed">Completed only</option>
          </select>
        </label>
        <label>
          Signing system
          <select name="source" defaultValue={params.source ?? ""}>
            <option value="">All systems</option>
            <option value="coastal">Coastal E-Sign</option>
            <option value="docusign">DocuSign</option>
          </select>
        </label>
        <label>
          Template
          <select name="templateId" defaultValue={params.templateId ?? ""}>
            <option value="">All templates</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sent
          <select name="sent" defaultValue={params.sent ?? ""}>
            <option value="">Any time</option>
            <option value="today">Today</option>
          </select>
        </label>
        <button type="submit">Apply</button>
        <Link href="/sign-docs">Reset</Link>
      </form>
      <p className={styles.muted} style={{ marginBottom: 12 }}>
        One row per recipient, including existing DocuSign records. Dates shown
        in UTC.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {[
                "Document / record",
                "Recipient",
                "Status",
                "Signing system",
                "Sent by",
                "Sent",
                "Viewed",
                "Signed",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  No documents match these filters.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const state = centerStatus(row, now);
              const record = row.opportunity
                ? {
                    href: `/opportunities/${row.opportunity.id}`,
                    name: row.opportunity.name,
                  }
                : row.account
                  ? {
                      href: `/accounts/${row.account.id}`,
                      name: row.account.name,
                    }
                  : row.lead
                    ? {
                        href: `/leads/${row.lead.id}`,
                        name: row.lead.contactName,
                      }
                    : null;
              return (
                <tr key={row.id}>
                  <td>
                    <Link href={`/envelopes/${row.id}`}>
                      {row.documentName}
                    </Link>
                    {record && (
                      <small>
                        <Link href={record.href}>{record.name}</Link>
                      </small>
                    )}
                    {row.packetId && row.createdBy?.id === userId && (
                      <small>
                        <Link href={`/envelopes/packets/${row.packetId}`}>
                          View packet status
                        </Link>
                      </small>
                    )}
                  </td>
                  <td>
                    {row.signerName}
                    <small>{row.signerEmail}</small>
                  </td>
                  <td>
                    <span className={styles.badge} data-state={state}>
                      {state}
                    </span>
                    {row.status === "DRAFT" && row.packetId && (
                      <small>Waiting for routing or send</small>
                    )}
                  </td>
                  <td>
                    <span
                      className={styles.sourceBadge}
                      data-source={centerSource(row.externalSource)}
                    >
                      {centerSource(row.externalSource)}
                    </span>
                  </td>
                  <td>{row.createdBy?.name ?? "—"}</td>
                  <td>{date(row.sentAt)}</td>
                  <td>{date(row.viewedAt)}</td>
                  <td>{date(row.signedAt ?? row.completedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager params={params} page={page} total={total} />
    </>
  );
}
function Pager({
  params,
  page,
  total,
}: {
  params: Params;
  page: number;
  total: number;
}) {
  return (
    <div className={styles.pager}>
      <span>
        {total
          ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} of ${total.toLocaleString()}`
          : "0 results"}
      </span>
      <div>
        {page > 1 && (
          <Link href={href({ ...params, page: String(page - 1) })}>
            Previous
          </Link>
        )}
        {page * 50 < total && (
          <Link href={href({ ...params, page: String(page + 1) })}>Next</Link>
        )}
      </div>
    </div>
  );
}
async function Drafts({ userId, params }: { userId: string; params: Params }) {
  const where = { createdById: userId, status: "DRAFT" };
  const total = await prisma.signingPacket.count({ where });
  const page = Math.min(
    centerPage(params.page),
    Math.max(1, Math.ceil(total / 50)),
  );
  const drafts = await prisma.signingPacket.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 50,
    take: 50,
    select: { id: true, name: true, updatedAt: true },
  });
  return (
    <>
      <p className={styles.muted} style={{ marginBottom: 16 }}>
        Your saved packets that have not been sent. Open a draft to continue
        preparing it.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Draft</th>
              <th>Last updated (UTC)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{date(d.updatedAt)}</td>
                <td>
                  <Link href={`/envelopes/packets/${d.id}`}>
                    Continue preparing
                  </Link>
                </td>
              </tr>
            ))}
            {!drafts.length && (
              <tr>
                <td className={styles.empty} colSpan={3}>
                  No saved drafts. Use Send documents to start a packet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager params={{ ...params, tab: "drafts" }} page={page} total={total} />
    </>
  );
}
async function Activity({ params }: { params: Params }) {
  const total = await prisma.envelopeEvent.count();
  const page = Math.min(
    centerPage(params.page),
    Math.max(1, Math.ceil(total / 50)),
  );
  const events = await prisma.envelopeEvent.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 50,
    take: 50,
    select: {
      id: true,
      eventType: true,
      createdAt: true,
      envelope: {
        select: {
          id: true,
          documentName: true,
          signerName: true,
          signerEmail: true,
        },
      },
    },
  });
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Document</th>
              <th>Recipient</th>
              <th>Date (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{e.eventType.replaceAll("_", " ").toLowerCase()}</td>
                <td>
                  <Link href={`/envelopes/${e.envelope.id}`}>
                    {e.envelope.documentName}
                  </Link>
                </td>
                <td>
                  {e.envelope.signerName}
                  <small>{e.envelope.signerEmail}</small>
                </td>
                <td>{date(e.createdAt)}</td>
              </tr>
            ))}
            {!events.length && (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  No signing activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager
        params={{ ...params, tab: "activity" }}
        page={page}
        total={total}
      />
    </>
  );
}
function Rules() {
  return (
    <>
      <p className={styles.muted} style={{ marginBottom: 18 }}>
        Current rules used when generating documents from an opportunity.
        Reminder and expiration settings can be changed for each packet before
        sending.
      </p>
      <div className={styles.rules}>
        <section className={styles.card}>
          <h2>Documents included</h2>
          <p>
            The Coastal agreement is always included. The addendum is included
            when the opportunity requires it, or when selected during
            preparation.
          </p>
          <p>
            Required templates must be uploaded before a generated packet can be
            prepared.
          </p>
          <Link href={href({ tab: "templates" })}>
            Manage agreement templates →
          </Link>
        </section>
        <section className={styles.card}>
          <h2>Payment processor</h2>
          <p>
            Use the RAM agreement when the account’s payment processor is RAM.
            Otherwise, use the SAS agreement.
          </p>
        </section>
        <section className={styles.card}>
          <h2>Legal plan</h2>
          <p>
            Use Victory only when every creditor on the opportunity matches the
            Victory creditor list. Otherwise, use Citadel.
          </p>
          <details>
            <summary>
              View Victory creditor list ({VICTORY_CREDITORS.length})
            </summary>
            <p>{VICTORY_CREDITORS.join(" · ")}</p>
          </details>
        </section>
        <section className={styles.card}>
          <h2>Recipients and delivery</h2>
          <p>
            New packets default to a reminder every day and expiration after 30
            days. Set recipient signing order, message, reminders, and
            expiration in the Recipients step.
          </p>
          <p>
            Signature, initial, name, and date fields are assigned to recipients
            in Prepare &amp; Send. Each recipient’s progress appears in
            Documents.
          </p>
          <Link href="/envelopes/new">Prepare a packet →</Link>
        </section>
      </div>
    </>
  );
}
