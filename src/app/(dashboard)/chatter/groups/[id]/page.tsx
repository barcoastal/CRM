import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GroupDetail } from "./group-detail";

export const dynamic = "force-dynamic";

export default async function ChatterGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? "";

  const group = await prisma.chatterGroup.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, posts: true } },
    },
  });
  if (!group) notFound();

  const myMember = userId
    ? await prisma.chatterMember.findUnique({
        where: { groupId_userId: { groupId: id, userId } },
        select: { role: true },
      })
    : null;

  // Private group: only members can see.
  if (group.visibility === "private" && !myMember) {
    return (
      <div style={{ padding: "60px 24px", maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#181818" }}>Private group</h1>
        <p style={{ color: "#747474", fontSize: 13 }}>
          This group is private. Ask an existing member to invite you.
        </p>
        <Link href="/chatter/groups" style={{ color: "#0176d3" }}>Back to groups</Link>
      </div>
    );
  }

  const follow = userId
    ? await prisma.chatterFollow.findFirst({
        where: { userId, groupId: id, entityType: null, entityId: null },
        select: { id: true },
      })
    : null;

  const posts = await prisma.chatterPost.findMany({
    where: { groupId: id, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      reactions: { select: { id: true, userId: true, emoji: true } },
      _count: { select: { replies: true } },
    },
  });

  const serialized = posts.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    group: { id: group.id, name: group.name },
  }));

  return (
    <GroupDetail
      group={{
        id: group.id,
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        owner: group.owner,
        memberCount: group._count.members,
        postCount: group._count.posts,
      }}
      currentUserId={userId}
      isMember={!!myMember}
      myRole={myMember?.role ?? null}
      isFollowing={!!follow}
      initialPosts={serialized}
    />
  );
}
