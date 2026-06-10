import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "@/components/icons/lucide";
import { TemplateEditor } from "../template-editor";

export const dynamic = "force-dynamic";

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tpl = await prisma.emailTemplate.findUnique({
    where: { id },
    include: {
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          filename: true,
          contentType: true,
          byteSize: true,
          createdAt: true,
        },
      },
    },
  });
  if (!tpl) notFound();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link
          href="/email-templates"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#3052ff] font-semibold mb-3"
        >
          <ArrowLeft className="size-3.5" />
          Back to Email Templates
        </Link>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {tpl.name}
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">{tpl.developerName}</p>
      </div>

      <TemplateEditor
        mode="edit"
        templateId={tpl.id}
        initial={{
          name: tpl.name,
          developerName: tpl.developerName,
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml ?? "",
          description: tpl.description ?? "",
          folder: tpl.folder ?? "General",
          isActive: tpl.isActive,
        }}
        attachments={tpl.attachments.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
