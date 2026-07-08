import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatterLanding } from "./chatter-landing";

export const dynamic = "force-dynamic";

export default async function ChatterPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "";

  // Personal feed: posts from groups the user is in or records they follow.
  const [memberRows, followRows] = await Promise.all([
    prisma.chatterMember.findMany({
      where: { userId },
      select: { groupId: true },
    }),
    prisma.chatterFollow.findMany({
      where: { userId },
      select: { groupId: true, entityType: true, entityId: true },
    }),
  ]);

  const groupIds = Array.from(new Set([
    ...memberRows.map((m) => m.groupId),
    ...followRows.filter((f) => f.groupId).map((f) => f.groupId as string),
  ]));
  const recordFollows = followRows
    .filter((f) => f.entityType && f.entityId)
    .map((f) => ({ entityType: f.entityType as string, entityId: f.entityId as string }));

  const orConditions: Record<string, unknown>[] = [];
  if (groupIds.length > 0) orConditions.push({ groupId: { in: groupIds } });
  for (const f of recordFollows) orConditions.push({ entityType: f.entityType, entityId: f.entityId });

  const posts = orConditions.length > 0
    ? await prisma.chatterPost.findMany({
        where: { parentId: null, OR: orConditions },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          author: { select: { id: true, name: true, email: true, avatar: true } },
          group: { select: { id: true, name: true } },
          reactions: { select: { id: true, userId: true, emoji: true } },
          _count: { select: { replies: true } },
        },
      })
    : [];

  const myGroups = await prisma.chatterGroup.findMany({
    where: { id: { in: memberRows.map((m) => m.groupId) } },
    select: { id: true, name: true, _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });

  // Serialize for client component (Date -> string).
  const serialized = posts.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#181818", margin: 0 }}>
            Chatter
          </h1>
          <div style={{ fontSize: 12, color: "#747474", marginTop: 4 }}>
            Team feeds, groups, and @mentions
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/chatter/groups" style={btnGhost}>Browse Groups</Link>
          <Link href="/chatter/groups/new" style={btnPrimary}>+ New Group</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
        <ChatterLanding
          initialPosts={serialized}
          currentUserId={userId}
          myGroups={myGroups}
        />

        <aside>
          <div style={{ border: "1px solid #c9c9c9", borderRadius: 6, background: "#fff", padding: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#444444", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>
              My Groups
            </h3>
            {myGroups.length === 0 && (
              <div style={{ fontSize: 12, color: "#747474" }}>
                You are not a member of any groups yet. <Link href="/chatter/groups" style={{ color: "#0176d3" }}>Browse groups</Link>.
              </div>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {myGroups.map((g) => (
                <li key={g.id}>
                  <Link href={`/chatter/groups/${g.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 4, textDecoration: "none", color: "#181818", fontSize: 13 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: "#747474" }}>{g._count.members}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "6px 14px",
  background: "#0176d3",
  color: "#fff",
  border: "1px solid #0176d3",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
};

const btnGhost: React.CSSProperties = {
  padding: "6px 14px",
  background: "#fff",
  color: "#0176d3",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
};
