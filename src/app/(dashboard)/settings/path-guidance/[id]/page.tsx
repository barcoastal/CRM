import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PathGuidanceForm } from "@/components/path/path-guidance-form";

export const dynamic = "force-dynamic";

export default async function EditPathGuidancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.pathGuidance.findUnique({ where: { id } });
  if (!row) notFound();
  const keyFields = Array.isArray(row.keyFields)
    ? (row.keyFields as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return (
    <PathGuidanceForm
      mode="edit"
      initial={{
        id: row.id,
        entityType: row.entityType,
        stage: row.stage,
        keyFields,
        guidance: row.guidance,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      }}
    />
  );
}
