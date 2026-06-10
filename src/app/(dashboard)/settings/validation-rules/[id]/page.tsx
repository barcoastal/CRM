import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import { ValidationRuleBuilder } from "../_builder/builder";

export const dynamic = "force-dynamic";

export default async function EditValidationRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const rule = await prisma.validationRule.findUnique({ where: { id } });
  if (!rule) notFound();

  const meta = OBJECT_METADATA[rule.entityType];
  const fields = (meta?.fields ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
  }));

  return (
    <ValidationRuleBuilder
      mode="edit"
      entityType={rule.entityType}
      fields={fields}
      existing={{
        id: rule.id,
        name: rule.name,
        description: rule.description,
        entityType: rule.entityType,
        errorMessage: rule.errorMessage,
        errorFieldName: rule.errorFieldName,
        condition: rule.condition,
        fireOn: rule.fireOn,
        isActive: rule.isActive,
      }}
    />
  );
}
