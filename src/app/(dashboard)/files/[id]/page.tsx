import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FileDetail } from "./file-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FileDetailPage({ params }: PageProps) {
  const { id } = await params;
  const doc = await prisma.contentDocument.findUnique({
    where: { id },
    include: {
      latestVersion: true,
      folder: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      records: {
        include: { linkedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      shares: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!doc) notFound();
  return <FileDetail doc={doc} />;
}
