import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/slds/record-page";
import { RelatedList } from "@/components/slds/related-list";

/**
 * User record page (admin view) - SF-style: what a user owns across every
 * object, plus their full activity trail (audit log, field changes they made,
 * recent tasks/calls). The edit form lives at ./edit.
 */
export default async function UserRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: { select: { label: true } }, manager: { select: { id: true, name: true } } },
  });
  if (!user) notFound();

  const [leads, opps, accounts, contacts, openTasks, cases, audit, fieldChanges, recentTasks] = await Promise.all([
    prisma.lead.count({ where: { assignedToId: id } }),
    prisma.opportunity.count({ where: { assignedToId: id } }),
    prisma.account.count({ where: { ownerId: id } }),
    prisma.contact.count({ where: { ownerId: id } }),
    prisma.task.count({ where: { ownerId: id, status: { notIn: ["COMPLETED"] } } }),
    prisma.case.count({ where: { ownerId: id } }),
    prisma.auditLog.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.accountHistory.findMany({
      where: { changedById: id },
      orderBy: { changedAt: "desc" },
      take: 30,
      include: { account: { select: { id: true, name: true } } },
    }),
    prisma.task.findMany({ where: { ownerId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const owned: Array<{ label: string; count: number; href: string }> = [
    { label: "Leads", count: leads, href: `/leads?assignedToId=${id}` },
    { label: "Opportunities", count: opps, href: `/opportunities?view=owner:${id}` },
    { label: "Accounts", count: accounts, href: `/accounts?view=owner:${id}` },
    { label: "Contacts", count: contacts, href: `/contacts?view=owner:${id}` },
    { label: "Open Tasks", count: openTasks, href: `/tasks` },
    { label: "Cases", count: cases, href: `/cases` },
  ];

  const cell: React.CSSProperties = { fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 8, padding: "14px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#444444" }}>User</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#181818" }}>{user.name}</div>
          <div style={{ fontSize: 13, color: "#444444" }}>
            {user.email} · {user.profile?.label ?? user.role}
            {user.manager && <> · Manager: <Link href={`/settings/users/${user.manager.id}`} style={{ color: "#0176d3" }}>{user.manager.name}</Link></>}
          </div>
        </div>
        <StatusPill label={user.isActive ? "Active" : "Inactive"} tone={user.isActive ? "success" : "neutral"} />
        <div style={{ marginLeft: "auto" }}>
          <Link href={`/settings/users/${user.id}/edit`} className="slds-button slds-button_neutral">Edit</Link>
        </div>
      </div>

      {/* Owned records */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
        {owned.map((o) => (
          <Link key={o.label} href={o.href} style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 8, padding: "12px 14px", textDecoration: "none" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0176d3" }}>{o.count.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: "#444444" }}>{o.label}</div>
          </Link>
        ))}
      </div>

      {/* Recent tasks / calls */}
      <RelatedList
        entity="Task"
        title="Recent Activity (Tasks & Calls)"
        items={recentTasks}
        header={
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 2.4fr 0.8fr 1fr", gap: 8, fontWeight: 700, fontSize: 11, color: "#444444", textTransform: "uppercase" }}>
            <div>Date</div><div>Type</div><div>Subject</div><div>Status</div><div>Disposition</div>
          </div>
        }
        renderItem={(t) => (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 2.4fr 0.8fr 1fr", gap: 8 }}>
            <span style={cell}>{(t.completedAt ?? t.dueDate ?? t.createdAt).toLocaleString()}</span>
            <span style={cell}>{t.type}</span>
            <span style={cell}>{t.subject}</span>
            <span style={cell}>{t.status}</span>
            <span style={cell}>{t.disposition ?? "-"}</span>
          </div>
        )}
        emptyHint="No tasks or calls."
      />

      {/* Field changes made by this user */}
      <RelatedList
        entity="Account"
        title="Record Changes Made"
        items={fieldChanges}
        header={
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 1.2fr 1.2fr 1.2fr", gap: 8, fontWeight: 700, fontSize: 11, color: "#444444", textTransform: "uppercase" }}>
            <div>Date</div><div>Account</div><div>Field</div><div>Original Value</div><div>New Value</div>
          </div>
        }
        renderItem={(h) => (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 1.2fr 1.2fr 1.2fr", gap: 8 }}>
            <span style={cell}>{h.changedAt.toLocaleString()}</span>
            <Link href={`/accounts/${h.account.id}`} style={{ ...cell, color: "#0176d3" }}>{h.account.name}</Link>
            <span style={cell}>{h.field}</span>
            <span style={{ ...cell, color: "#747474" }}>{h.oldValue ?? "-"}</span>
            <span style={cell}>{h.newValue ?? "-"}</span>
          </div>
        )}
        emptyHint="No field changes recorded."
      />

      {/* App audit log entries for this user */}
      <RelatedList
        entity="User"
        title="Audit Log"
        items={audit}
        header={
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 2fr", gap: 8, fontWeight: 700, fontSize: 11, color: "#444444", textTransform: "uppercase" }}>
            <div>Date</div><div>Action</div><div>Entity</div><div>Record</div>
          </div>
        }
        renderItem={(a) => (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 2fr", gap: 8 }}>
            <span style={cell}>{a.createdAt.toLocaleString()}</span>
            <span style={cell}>{a.action}</span>
            <span style={cell}>{a.entity}</span>
            <span style={cell}>{a.entityId}</span>
          </div>
        )}
        emptyHint="No audit entries."
      />
      <div style={{ fontSize: 12, marginTop: 4 }}>
        <Link href="/settings/audit-log" style={{ color: "#0176d3" }}>Open full audit log</Link>
      </div>
    </div>
  );
}
