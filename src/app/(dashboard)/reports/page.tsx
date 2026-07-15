import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportsHome } from "@/components/reports/reports-home";

/**
 * Reports home - 1:1 with the SF Reports tab: left rail (Recent, Created by
 * Me, Private/Public/All Reports, Folders, Favorites), search, and the
 * Name | Description | Folder | Created By | Created On table.
 */
export default async function ReportsPage() {
  const session = await auth();
  const myId = session?.user?.id ?? null;

  const [reports, folders] = await Promise.all([
    prisma.report.findMany({
      orderBy: { updatedAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.reportFolder.findMany({ orderBy: { name: "asc" } }),
  ]);

  const folderNames = Array.from(
    new Set([...folders.map((f) => f.name), ...reports.map((r) => r.folder)]),
  ).sort();

  return (
    <ReportsHome
      myId={myId}
      folders={folderNames}
      reports={reports.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        folder: r.folder,
        objectType: r.objectType,
        createdById: r.createdById,
        createdByName: r.createdBy?.name ?? "System",
        createdAt: r.createdAt.toISOString(),
        lastRunAt: r.lastRunAt?.toISOString() ?? null,
        isShared: r.isShared,
      }))}
    />
  );
}
