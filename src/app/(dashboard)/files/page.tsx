import { prisma } from "@/lib/prisma";
import { FilesBrowser } from "./files-browser";

interface PageProps {
  searchParams: Promise<{ folderId?: string; q?: string }>;
}

export default async function FilesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const folderId = sp.folderId && sp.folderId !== "root" ? sp.folderId : null;
  const q = sp.q?.trim() ?? "";

  const [folders, allFolders, currentFolder, docs] = await Promise.all([
    prisma.contentLibraryFolder.findMany({
      where: { parentId: folderId },
      orderBy: { name: "asc" },
      include: { _count: { select: { files: true, children: true } } },
    }),
    prisma.contentLibraryFolder.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    folderId
      ? prisma.contentLibraryFolder.findUnique({ where: { id: folderId } })
      : Promise.resolve(null),
    prisma.contentDocument.findMany({
      where: {
        folderId,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        latestVersion: true,
        owner: { select: { id: true, name: true } },
        _count: { select: { versions: true, records: true, shares: true } },
      },
      take: 100,
    }),
  ]);

  return (
    <FilesBrowser
      currentFolder={currentFolder}
      folders={folders}
      allFolders={allFolders}
      docs={docs}
      q={q}
    />
  );
}
