import { iconUrl, ENTITY_ICONS } from "@/lib/slds/object-icons";

const OBJECT_ICON_PX: Record<string, number> = {
  "xx-small": 16,
  "x-small": 20,
  small: 24,
  medium: 32,
  large: 48,
};

/**
 * Object icon — playful illustrated tile (custom Coastal icon set). Each
 * illustration is self-contained on a transparent background, so it renders
 * as a plain sized image (no SLDS colored square anymore).
 *
 * Sizes: xx-small (16px), x-small (20px), small (24px), medium (32px), large (48px)
 */
export function ObjectIcon({
  entity,
  size = "medium",
  title,
}: {
  entity: string;
  size?: "xx-small" | "x-small" | "small" | "medium" | "large";
  title?: string;
}) {
  const key = (ENTITY_ICONS[entity as keyof typeof ENTITY_ICONS] ? entity : "Account") as keyof typeof ENTITY_ICONS;
  const url = iconUrl(key);
  const px = OBJECT_ICON_PX[size] ?? 32;

  return (
    <img
      src={url}
      alt={title ?? entity}
      title={title ?? entity}
      width={px}
      height={px}
      style={{ width: px, height: px, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }}
    />
  );
}

/**
 * Utility icon (chevrons, plus, search, etc.) — small, monochrome.
 */
export function UtilityIcon({
  name,
  size = "x-small",
  className,
}: {
  name: string;
  size?: "xx-small" | "x-small" | "small" | "medium" | "large";
  className?: string;
}) {
  return (
    <svg className={`slds-icon slds-icon_${size} ${className ?? ""}`} aria-hidden="true">
      <use xlinkHref={`/slds/icons/utility-sprite/svg/symbols.svg#${name}`} />
    </svg>
  );
}
