import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditClient } from "./edit-client";

export const dynamic = "force-dynamic";

export default async function ESignTemplateDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await props.params;

  const tpl = await prisma.envelopeTemplate.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!tpl) notFound();

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {tpl.name}
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          <Link href="/templates/esign" className="text-[#3052ff]">
            E-Sign Templates
          </Link>{" "}
          / {tpl.pdfFilename}
        </p>
      </div>

      <EditClient
        initial={{
          id: tpl.id,
          name: tpl.name,
          recordType: tpl.recordType,
          description: tpl.description,
          isActive: tpl.isActive,
          pageCount: tpl.pageCount,
          pdfFilename: tpl.pdfFilename,
          mergeMapping: (tpl.mergeMapping ?? {}) as Record<string, string>,
          signatureBoxes: (tpl.signatureBoxes ?? []) as unknown[],
          initialBoxes: (tpl.initialBoxes ?? []) as unknown[],
          dateBoxes: (tpl.dateBoxes ?? []) as unknown[],
          textBoxes: (tpl.textBoxes ?? []) as unknown[],
          createdByName: tpl.createdBy?.name ?? null,
          createdAt: tpl.createdAt.toISOString(),
        }}
      />
    </div>
  );
}
