import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserProfileLayout } from "@/components/users/user-profile-layout";
import { FollowButton } from "@/components/chatter/follow-button";
import { RelatedList } from "@/components/slds/related-list";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { USER_RECORD_PAGE_SIZE, userOwnedRecords, userRecordType } from "@/lib/user-owned-records";
import { ViewAsUserButton } from "@/components/admin/user-preview";

/**
 * User record page (admin view) - SF-style: what a user owns across every
 * object, plus their full activity trail (audit log, field changes they made,
 * recent tasks/calls). The edit form lives at ./edit.
 */
export default async function UserRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ records?: string; page?: string; activityPage?: string; auditPage?: string; changesPage?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return <div role="alert" style={{ padding: 24 }}><h1>Access denied</h1><p>You don’t have permission to view user profiles. Only administrators can access this page.</p></div>;
  }
  const { id } = await params;
  const query = await searchParams;
  const recordsType = userRecordType(query.records);
  const pageNumber = (value?: string) => Math.min(100000, Math.max(1, Number.parseInt(value ?? "1", 10) || 1));
  const page = pageNumber(query.page);
  const activityPage = pageNumber(query.activityPage);
  const auditPage = pageNumber(query.auditPage);
  const changesPage = pageNumber(query.changesPage);
  const profileHref = (patch: Record<string, string | number>, anchor = "owned-records") => {
    const values = { records: recordsType, page, activityPage, auditPage, changesPage, ...patch };
    return `/settings/users/${encodeURIComponent(id)}?${new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))}#${anchor}`;
  };
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: { select: { label: true } }, manager: { select: { id: true, name: true } } },
  });
  if (!user) notFound();

  const [leads, opps, accounts, contacts, tasks, cases, audit, fieldChanges, recentTasks, records] = await Promise.all([
    prisma.lead.count({ where: { assignedToId: id } }),
    prisma.opportunity.count({ where: { assignedToId: id } }),
    prisma.account.count({ where: { ownerId: id } }),
    prisma.contact.count({ where: { ownerId: id } }),
    prisma.task.count({ where: { ownerId: id } }),
    prisma.case.count({ where: { ownerId: id } }),
    prisma.auditLog.findMany({ where: { userId: id }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (auditPage - 1) * 50, take: 51 }),
    prisma.accountHistory.findMany({
      where: { changedById: id },
      orderBy: [{ changedAt: "desc" }, { id: "asc" }],
      skip: (changesPage - 1) * 30, take: 31,
      include: { account: { select: { id: true, name: true } } },
    }),
    prisma.task.findMany({ where: { ownerId: id }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (activityPage - 1) * 30, take: 31 }),
    userOwnedRecords(id, recordsType, page),
  ]);

  const [files, memberships, followers, follows, posts] = await Promise.all([
    prisma.contentRecordLink.findMany({ where: { entityType: "User", entityId: id }, include: { document: { select: { id: true, title: true } } } }),
    prisma.chatterMember.findMany({ where: { userId: id, group: { OR: [{ visibility: "public" }, { members: { some: { userId: session.user.id } } }] } }, include: { group: { select: { id: true, name: true } } } }),
    prisma.chatterFollow.findMany({ where: { entityType: "User", entityId: id }, include: { user: { select: { id: true, name: true, avatar: true } } } }),
    prisma.chatterFollow.findMany({ where: { userId: id, entityType: "User", entityId: { not: null } }, select: { entityId: true } }),
    prisma.chatterPost.findMany({ where: { entityType: "User", entityId: id, parentId: null }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, body: true, createdAt: true, author: { select: { name: true } } } }),
  ]);
  const followingUsers = await prisma.user.findMany({ where: { id: { in: follows.flatMap(f => f.entityId ? [f.entityId] : []) } }, select: { id: true, name: true, avatar: true } });
  const personLink = (person: { id: string; name: string; avatar: string | null }) => ({ ...person, href: `/settings/users/${person.id}` });
  const related = {
    files: files.map(f => ({ id: f.document.id, name: f.document.title, href: `/files/${f.document.id}` })),
    groups: memberships.map(m => ({ id: m.group.id, name: m.group.name, href: `/chatter/groups/${m.group.id}` })),
    followers: followers.map(f => personLink(f.user)), following: followingUsers.map(personLink),
  };

  const owned: Array<{ label: string; count: number; href: string }> = [
    { label: "Leads", count: leads, href: profileHref({ records: "leads", page: 1 }) },
    { label: "Opportunities", count: opps, href: profileHref({ records: "opportunities", page: 1 }) },
    { label: "Accounts", count: accounts, href: profileHref({ records: "accounts", page: 1 }) },
    { label: "Contacts", count: contacts, href: profileHref({ records: "contacts", page: 1 }) },
    { label: "Tasks & Calls", count: tasks, href: profileHref({ records: "tasks", page: 1 }) },
    { label: "Cases", count: cases, href: profileHref({ records: "cases", page: 1 }) },
  ];

  const selectedIndex = ["leads", "opportunities", "accounts", "contacts", "tasks", "cases"].indexOf(recordsType);
  const selected = owned[selectedIndex];
  const pager = (current: number, hasNext: boolean, key: string, anchor: string) => (
    <nav aria-label={`${anchor} pages`} style={{ display: "flex", gap: 16, margin: "8px 0 20px", fontSize: 13 }}>
      {current > 1 && <Link href={profileHref({ [key]: current - 1 }, anchor)}>Previous</Link>}
      <span>Page {current}</span>
      {hasNext && <Link href={profileHref({ [key]: current + 1 }, anchor)}>Next</Link>}
    </nav>
  );

  const cell: React.CSSProperties = { fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <UserProfileLayout user={user} related={related} posts={posts} actions={<>
      {!session.impersonation && user.id !== session.user.id && <FollowButton entityType="User" entityId={id} initialFollowing={followers.some(f => f.user.id === session.user.id)} />}
      {hasPermission(session.user.permissions, "User.Edit") && <Link href={`/settings/users/${user.id}/edit`}>Edit</Link>}
      <a href="#user-detail">User Detail</a>
      {!session.impersonation && !session.user.mustResetPassword && user.isActive && user.id !== session.user.id && <ViewAsUserButton userId={user.id} userName={user.name} />}
    </>}>
      {/* Owned records */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
        {owned.map((o) => (
          <Link key={o.label} href={o.href} aria-current={o === selected ? "page" : undefined} style={{ background: o === selected ? "#eef4ff" : "#fff", border: `1px solid ${o === selected ? "#0176d3" : "#c9c9c9"}`, borderRadius: 8, padding: "12px 14px", textDecoration: "none" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0176d3" }}>{o.count.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: "#444444" }}>{o.label}</div>
          </Link>
        ))}
      </div>

      <section id="owned-records" aria-label="Assigned work">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{selected.label} — {selected.count.toLocaleString()} assigned</h2>
        <p style={{ fontSize: 12, color: "#444444", marginBottom: 8 }}>Select a category above to see this user’s records, including completed and converted work.</p>
        <RelatedList
          entity={["Lead", "Opportunity", "Account", "Contact", "Task", "Case"][selectedIndex]}
          title={selected.label}
          items={records}
          renderItem={(record) => (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <Link href={`/${recordsType}/${record.id}`} style={{ color: "#0176d3" }}>{record.name}</Link>
              <span style={cell}>{record.detail || "—"}</span>
              <span style={cell}>{record.status || "—"}</span>
            </div>
          )}
          emptyHint="No assigned records."
        />
        {pager(page, page * USER_RECORD_PAGE_SIZE < selected.count, "page", "owned-records")}
      </section>

      <div id="activity" />
      {/* Recent tasks / calls */}
      <RelatedList
        entity="Task"
        title="Recent Activity (Tasks & Calls)"
        items={recentTasks.slice(0, 30)}
        header={
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 2.4fr 0.8fr 1fr", gap: 8, fontWeight: 700, fontSize: 11, color: "#444444", textTransform: "uppercase" }}>
            <div>Date</div><div>Type</div><div>Subject</div><div>Status</div><div>Disposition</div>
          </div>
        }
        renderItem={(t) => (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 2.4fr 0.8fr 1fr", gap: 8 }}>
            <span style={cell}>{(t.completedAt ?? t.dueDate ?? t.createdAt).toLocaleString()}</span>
            <span style={cell}>{t.type}</span>
            <Link href={`/tasks/${t.id}`} style={{ ...cell, color: "#0176d3" }}>{t.subject}</Link>
            <span style={cell}>{t.status}</span>
            <span style={cell}>{t.disposition ?? "-"}</span>
          </div>
        )}
        emptyHint="No tasks or calls."
      />

      {pager(activityPage, recentTasks.length > 30, "activityPage", "activity")}
      <div id="changes" />
      {/* Field changes made by this user */}
      <RelatedList
        entity="Account"
        title="Record Changes Made"
        items={fieldChanges.slice(0, 30)}
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

      {pager(changesPage, fieldChanges.length > 30, "changesPage", "changes")}
      <div id="audit" />
      {/* App audit log entries for this user */}
      <RelatedList
        entity="User"
        title="Audit Log"
        items={audit.slice(0, 50)}
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
      {pager(auditPage, audit.length > 50, "auditPage", "audit")}
      <div style={{ fontSize: 12, marginTop: 4 }}>
        <Link href="/settings/audit-log" style={{ color: "#0176d3" }}>Open full audit log</Link>
      </div>
      <section id="user-detail" style={{ marginTop: 20, scrollMarginTop: 100, borderTop: "1px solid #d8d8d8", paddingTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>User Detail</h2>
        <p>{user.profile?.label ?? user.role} · {user.isActive ? "Active" : "Inactive"}</p>
        <p>Last login: {user.lastLoginAt?.toLocaleString() ?? "Never"}</p>
      </section>
    </UserProfileLayout>
  );
}
