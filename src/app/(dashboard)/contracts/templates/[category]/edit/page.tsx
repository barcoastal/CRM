import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/contracts/templates";
import { DocxFieldEditor } from "@/components/contracts/docx-field-editor";

export default async function EditTemplatePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const meta = CATEGORIES.find((c) => c.key === category);
  if (!meta) notFound();
  return <DocxFieldEditor category={meta.key} label={meta.label} />;
}
