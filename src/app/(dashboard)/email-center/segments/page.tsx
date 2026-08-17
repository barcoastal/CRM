import { prisma } from "@/lib/prisma";
import { SegmentsClient } from "./segments-client";

export const dynamic = "force-dynamic";

export default async function EmailCenterSegmentsPage() {
  const segments = await prisma.segment.findMany({
    orderBy: { updatedAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return (
    <SegmentsClient
      initial={segments.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        entity: s.entity,
        filters: (s.filters as Array<{ field: string; op: string; value?: unknown }>) ?? [],
        createdByName: s.createdBy?.name ?? null,
        updatedAt: s.updatedAt.toISOString(),
      }))}
    />
  );
}
