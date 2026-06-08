import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationsList } from "@/components/notifications/notifications-list";

/**
 * Full notification history. Server-rendered initial page (last 50). The
 * client component takes over for filter changes + pagination + mark-as-read.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string; status?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <div className="p-6 text-[13px] text-[#706e6b]">Please sign in to view notifications.</div>
    );
  }
  const sp = (await searchParams) ?? {};
  const kind = sp.kind && sp.kind !== "ALL" ? sp.kind : undefined;
  const status = sp.status && sp.status !== "ALL" ? sp.status : undefined;

  const where: Record<string, unknown> = {
    recipientId: userId,
    archivedAt: null,
  };
  if (kind) where.kind = kind;
  if (status === "UNREAD") where.readAt = null;
  if (status === "READ") where.readAt = { not: null };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.notification.count({
      where: { recipientId: userId, readAt: null, archivedAt: null },
    }),
  ]);

  const initial = items.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    url: n.url,
    entityType: n.entityType,
    entityId: n.entityId,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    archivedAt: n.archivedAt ? n.archivedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor
      ? { id: n.actor.id, name: n.actor.name, email: n.actor.email }
      : null,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Notifications
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Records assigned to you, approvals waiting on you, signed envelopes, mass-email results,
            and mentions all land here.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-[12px] font-semibold text-[#3052ff]"
        >
          Back to Home
        </Link>
      </div>

      <NotificationsList
        initial={initial}
        initialUnreadCount={unreadCount}
        initialKind={kind ?? "ALL"}
        initialStatus={status ?? "ALL"}
      />
    </div>
  );
}
