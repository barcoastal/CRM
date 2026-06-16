import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { LeadListDetail } from "@/components/engagement/list-detail";

export const dynamic = "force-dynamic";

export default async function LeadListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;

  const list = await prisma.leadList.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
  if (!list) notFound();

  const [memberCount, members] = await Promise.all([
    prisma.leadListMember.count({ where: { listId: id } }),
    prisma.leadListMember.findMany({
      where: { listId: id },
      orderBy: { addedAt: "desc" },
      take: 50,
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {list.name}
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
            <Link href="/marketing/engagement" className="text-[#3052ff]">Engagement</Link> /{" "}
            <Link href="/marketing/engagement/lists" className="text-[#3052ff]">Lead Lists</Link> /{" "}
            {list.name}
          </p>
        </div>
      </div>

      <LeadListDetail
        list={{
          id: list.id,
          name: list.name,
          description: list.description,
          isActive: list.isActive,
        }}
        memberCount={memberCount}
        members={members.map((m) => ({
          id: m.id,
          source: m.source,
          addedAt: m.addedAt.toISOString(),
          lead: m.lead,
        }))}
      />
    </div>
  );
}
