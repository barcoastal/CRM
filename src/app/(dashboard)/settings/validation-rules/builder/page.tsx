import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import { ValidationRuleBuilder } from "../_builder/builder";

const SUPPORTED = ["Lead", "Opportunity", "Account", "Case", "Task", "Event"];

export default async function ValidationRuleBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const entityType = params.entityType ?? "Lead";

  if (!SUPPORTED.includes(entityType)) {
    redirect("/settings/validation-rules/new");
  }

  const meta = OBJECT_METADATA[entityType];
  // Surface the field list from the report builder metadata as the picker's
  // source of truth, so authors see exactly the same fields they use in
  // reports and list views.
  const fields = (meta?.fields ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
  }));

  return (
    <ValidationRuleBuilder
      mode="create"
      entityType={entityType}
      fields={fields}
    />
  );
}
