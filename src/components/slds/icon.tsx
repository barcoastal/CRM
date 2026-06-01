import { iconUrl, ENTITY_ICONS } from "@/lib/slds/object-icons";

/**
 * Object icon — colored SLDS square + glyph. Uses SLDS's own
 * .slds-icon_container + .slds-icon-standard-{name} for the background
 * color (no custom CSS needed).
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
  const info = ENTITY_ICONS[entity as keyof typeof ENTITY_ICONS] ?? ENTITY_ICONS.Account;
  const url = iconUrl(entity as keyof typeof ENTITY_ICONS);
  const sldsKey = info.iconName.replace(/_/g, "_"); // e.g. "service_contract"

  return (
    <span
      className={`slds-icon_container slds-icon-${info.iconSet}-${sldsKey}`}
      title={title ?? entity}
    >
      <span className={`slds-icon slds-icon_container slds-icon-${info.iconSet}-${sldsKey} slds-icon_${size}`}>
        <img src={url} alt={title ?? entity} className="slds-icon" />
      </span>
    </span>
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
