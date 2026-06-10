import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";

type TemplateRow = {
  id: string;
  name: string;
  developerName: string;
  subject: string;
  folder: string | null;
  isActive: boolean;
  createdBy: { id: string; name: string } | null;
};

export default async function EmailTemplatesPage() {
  const items = await prisma.emailTemplate.findMany({
    where: { isActive: true },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  const total = await prisma.emailTemplate.count({ where: { isActive: true } });
  const columns: ListViewColumn<TemplateRow>[] = [
    { key: "name", label: "Name", render: (t) => t.name },
    { key: "dev", label: "Developer Name", render: (t) => t.developerName },
    { key: "subject", label: "Subject", render: (t) => t.subject },
    { key: "folder", label: "Folder", render: (t) => t.folder ?? "General" },
    { key: "by", label: "Created By", render: (t) => t.createdBy?.name ?? "" },
  ];
  return (
    <ListView
      entity="Email"
      entityLabel="Email Template"
      viewName="All Templates"
      totalCount={total}
      rows={items as TemplateRow[]}
      columns={columns}
      rowHref={(t) => `/email-templates/${t.id}`}
      newHref="/email-templates/new"
    />
  );
}
