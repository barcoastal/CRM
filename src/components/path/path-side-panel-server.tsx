import { getGuidance } from "@/lib/path/guidance";
import { PathSidePanel } from "./path-side-panel";
import type { EntityKey } from "@/lib/path/field-labels";

/**
 * Server wrapper that loads the PathGuidance row for an entity+stage pair
 * via the React-cached `getGuidance` helper and hands it to the client
 * `PathSidePanel`. Use this directly inside server detail pages.
 */
export async function PathSidePanelServer({
  entityType,
  stage,
  record,
  canEdit = true,
}: {
  entityType: EntityKey;
  stage: string | null | undefined;
  record: Record<string, unknown> | null | undefined;
  canEdit?: boolean;
}) {
  const guidance = stage ? await getGuidance(entityType, stage) : null;
  return (
    <PathSidePanel
      entityType={entityType}
      stage={stage}
      record={record as Record<string, unknown> | null | undefined}
      guidance={guidance}
      canEdit={canEdit}
    />
  );
}
