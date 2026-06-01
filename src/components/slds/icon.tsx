import { iconUrl, iconBg } from "@/lib/slds/object-icons";

/**
 * Object icon — the colored square + glyph used everywhere SF puts an
 * object reference (header, tabs, related list rows).
 *
 * Sizes follow SLDS scale:
 *   xx-small (16px), x-small (20px), small (24px), medium (32px), large (48px)
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
  const pxBySize: Record<string, number> = {
    "xx-small": 16, "x-small": 20, small: 24, medium: 32, large: 48,
  };
  const px = pxBySize[size];
  const url = iconUrl(entity as keyof typeof import("@/lib/slds/object-icons").ENTITY_ICONS);
  const bg = iconBg(entity as keyof typeof import("@/lib/slds/object-icons").ENTITY_ICONS);

  return (
    <span
      className={`slds-icon_container slds-icon-standard-${entity.toLowerCase()} ${bg}`}
      title={title ?? entity}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: px,
        height: px,
        borderRadius: 4,
        flexShrink: 0,
      }}
    >
      <img
        src={url}
        alt={title ?? entity}
        width={Math.round(px * 0.6)}
        height={Math.round(px * 0.6)}
        style={{ filter: "brightness(0) invert(1)" }}
      />
    </span>
  );
}

/**
 * Utility icon (chevrons, plus, search, etc.) — small, monochrome.
 */
export function UtilityIcon({
  name,
  size = 16,
  className,
  color,
}: {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <img
      src={`/slds/icons/utility/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={color ? { filter: `brightness(0) saturate(100%) ${color}` } : undefined}
    />
  );
}
