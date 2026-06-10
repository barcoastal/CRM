import { PathGuidanceForm } from "@/components/path/path-guidance-form";
import { ENTITY_KEYS, type EntityKey } from "@/lib/path/field-labels";

export default async function NewPathGuidancePage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; stage?: string }>;
}) {
  const sp = await searchParams;
  const entity = (ENTITY_KEYS as readonly string[]).includes(sp.entity ?? "")
    ? (sp.entity as EntityKey)
    : "Lead";
  return (
    <PathGuidanceForm
      mode="create"
      initial={{
        entityType: entity,
        stage: sp.stage ?? "",
        keyFields: [],
        guidance: "",
        sortOrder: 0,
        isActive: true,
      }}
    />
  );
}
