import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ChatterGroupsPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "";

  const memberRows = await prisma.chatterMember.findMany({
    where: { userId },
    select: { groupId: true, role: true },
  });
  const memberMap = new Map(memberRows.map((m) => [m.groupId, m.role]));

  const allVisible = await prisma.chatterGroup.findMany({
    where: {
      OR: [
        { visibility: "public" },
        { id: { in: Array.from(memberMap.keys()) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { members: true, posts: true } },
    },
  });

  const myGroups = allVisible.filter((g) => memberMap.has(g.id));
  const otherGroups = allVisible.filter((g) => !memberMap.has(g.id));

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#080707", margin: 0 }}>Chatter Groups</h1>
          <div style={{ fontSize: 12, color: "#706e6b", marginTop: 4 }}>
            Find your team or start a new conversation
          </div>
        </div>
        <Link href="/chatter/groups/new" style={btnPrimary}>+ New Group</Link>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h2 style={sectionH}>My Groups</h2>
        {myGroups.length === 0 ? (
          <div style={emptyBox}>
            You have not joined any groups yet. Find one below or create a new one.
          </div>
        ) : (
          <div style={gridStyle}>
            {myGroups.map((g) => <GroupCard key={g.id} g={g} />)}
          </div>
        )}
      </section>

      <section>
        <h2 style={sectionH}>Discover Groups</h2>
        {otherGroups.length === 0 ? (
          <div style={emptyBox}>No more public groups to discover. Try creating one.</div>
        ) : (
          <div style={gridStyle}>
            {otherGroups.map((g) => <GroupCard key={g.id} g={g} />)}
          </div>
        )}
      </section>
    </div>
  );
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  owner: { id: string; name: string } | null;
  _count: { members: number; posts: number };
}

function GroupCard({ g }: { g: GroupRow }) {
  const initials = g.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Link
      href={`/chatter/groups/${g.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 16,
        border: "1px solid #d8dde6",
        borderRadius: 6,
        background: "#fff",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 6, background: "#16325c",
          color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {initials || "G"}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#080707", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.name}
          </div>
          <div style={{ fontSize: 11, color: "#706e6b", marginTop: 2 }}>
            {g.visibility === "private" ? "Private group" : "Public group"}
          </div>
        </div>
      </div>
      {g.description && (
        <div style={{ fontSize: 12, color: "#3e3e3c", lineHeight: 1.4 }}>{g.description}</div>
      )}
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#706e6b", marginTop: "auto", paddingTop: 6 }}>
        <span>{g._count.members} members</span>
        <span>{g._count.posts} posts</span>
      </div>
    </Link>
  );
}

const sectionH: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginTop: 0,
  marginBottom: 10,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 12,
};

const emptyBox: React.CSSProperties = {
  padding: 18,
  border: "1px dashed #d8dde6",
  borderRadius: 6,
  color: "#706e6b",
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  padding: "6px 14px",
  background: "#0070d2",
  color: "#fff",
  border: "1px solid #0070d2",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
};
