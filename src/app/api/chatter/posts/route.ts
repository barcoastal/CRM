import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { extractMentionIds } from "@/lib/chatter/mentions";
import { notify } from "@/lib/notifications/notify";

const postSchema = z.object({
  groupId: z.string().cuid().optional(),
  entityType: z.string().min(1).max(64).optional(),
  entityId: z.string().min(1).max(64).optional(),
  body: z.string().min(1).max(10000),
  parentId: z.string().cuid().optional(),
});

/** Build the relative URL where a post (or its parent record) can be found. */
function urlFor(entityType: string | null | undefined, entityId: string | null | undefined, groupId: string | null | undefined): string {
  if (groupId) return `/chatter/groups/${groupId}`;
  if (entityType && entityId) {
    // PascalCase entity -> lowercase plural path. Covers the common cases.
    const t = entityType.toLowerCase();
    const pluralMap: Record<string, string> = {
      lead: "leads",
      account: "accounts",
      contact: "contacts",
      opportunity: "opportunities",
      client: "clients",
      case: "cases",
      task: "tasks",
      event: "events",
      programplan: "program-plans",
      offer: "offers",
      settlement: "settlements",
      creditor: "creditors",
    };
    const path = pluralMap[t] ?? `${t}s`;
    return `/${path}/${entityId}`;
  }
  return "/chatter";
}

/** Resolve a friendly context label (used in follow notifications). */
async function contextLabel(opts: { groupId?: string | null; entityType?: string | null; entityId?: string | null }): Promise<string> {
  if (opts.groupId) {
    const g = await prisma.chatterGroup.findUnique({ where: { id: opts.groupId }, select: { name: true } });
    return g?.name ? `Chatter group "${g.name}"` : "a Chatter group";
  }
  if (opts.entityType && opts.entityId) {
    return `${opts.entityType} record`;
  }
  return "Chatter";
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  // Validate exactly one of: groupId / (entityType + entityId).
  const hasGroup = !!d.groupId;
  const hasRecord = !!(d.entityType && d.entityId);
  if (hasGroup === hasRecord) {
    return NextResponse.json(
      { error: "Provide exactly one of groupId or (entityType + entityId)" },
      { status: 400 },
    );
  }

  // If groupId is private, ensure the user is a member.
  if (d.groupId) {
    const g = await prisma.chatterGroup.findUnique({
      where: { id: d.groupId },
      select: { id: true, visibility: true, name: true },
    });
    if (!g) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (g.visibility === "private") {
      const member = await prisma.chatterMember.findUnique({
        where: { groupId_userId: { groupId: d.groupId, userId: session.userId } },
        select: { id: true },
      });
      if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // If parentId provided, ensure it exists and inherit context.
  let groupId = d.groupId ?? null;
  let entityType = d.entityType ?? null;
  let entityId = d.entityId ?? null;
  if (d.parentId) {
    const parent = await prisma.chatterPost.findUnique({
      where: { id: d.parentId },
      select: { id: true, groupId: true, entityType: true, entityId: true },
    });
    if (!parent) return NextResponse.json({ error: "Parent post not found" }, { status: 404 });
    groupId = parent.groupId;
    entityType = parent.entityType;
    entityId = parent.entityId;
  }

  const mentionIds = extractMentionIds(d.body);

  const created = await prisma.chatterPost.create({
    data: {
      groupId,
      entityType,
      entityId,
      authorId: session.userId,
      body: d.body,
      mentions: mentionIds,
      parentId: d.parentId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      reactions: true,
      _count: { select: { replies: true } },
    },
  });

  // Fire notifications (best-effort).
  try {
    const ctx = await contextLabel({ groupId, entityType, entityId });
    const postUrl = urlFor(entityType, entityId, groupId);

    // 1) @mentions
    if (mentionIds.length > 0) {
      await notify({
        recipientIds: mentionIds,
        kind: "MENTION",
        title: `${created.author.name} mentioned you`,
        body: d.body.slice(0, 200),
        url: postUrl,
        entityType: entityType ?? (groupId ? "ChatterGroup" : null),
        entityId: entityId ?? groupId ?? null,
        actorId: session.userId,
        skipIfSelf: true,
      });
    }

    // 2) Followers of the group/record.
    const followWhere = groupId
      ? { groupId }
      : { entityType: entityType ?? undefined, entityId: entityId ?? undefined };
    const followers = await prisma.chatterFollow.findMany({
      where: followWhere,
      select: { userId: true },
    });
    const followerIds = followers.map((f) => f.userId).filter((id) => !mentionIds.includes(id));
    if (followerIds.length > 0) {
      await notify({
        recipientIds: followerIds,
        kind: "GENERIC",
        title: `${created.author.name} posted in ${ctx}`,
        body: d.body.slice(0, 200),
        url: postUrl,
        entityType: entityType ?? (groupId ? "ChatterGroup" : null),
        entityId: entityId ?? groupId ?? null,
        actorId: session.userId,
        skipIfSelf: true,
      });
    }
  } catch (err) {
    console.error("[chatter] notification fan-out failed", err);
  }

  return NextResponse.json(created, { status: 201 });
}

/** Optional GET: list posts. Filter by groupId / entity / authorId. */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const where: Record<string, unknown> = { parentId: null };
  const groupId = url.searchParams.get("groupId");
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const authorId = url.searchParams.get("authorId");
  if (groupId) where.groupId = groupId;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (authorId) where.authorId = authorId;

  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
  const cursor = url.searchParams.get("cursor");

  const posts = await prisma.chatterPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      reactions: { select: { id: true, userId: true, emoji: true } },
      group: { select: { id: true, name: true } },
      _count: { select: { replies: true } },
    },
  });

  return NextResponse.json({
    items: posts,
    nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
  });
}
