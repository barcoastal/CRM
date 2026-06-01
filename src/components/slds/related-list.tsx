import Link from "next/link";
import type { ReactNode } from "react";
import { ObjectIcon, UtilityIcon } from "./icon";

/**
 * SF-style "related list" card. Used in the right rail of record pages
 * (e.g. "Contacts (3)" on an Account detail page).
 */
export function RelatedList<T extends { id: string }>({
  entity,
  title,
  items,
  renderItem,
  emptyHint = "Nothing to show",
  newHref,
  viewAllHref,
}: {
  entity: string;
  title: string;
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  emptyHint?: string;
  newHref?: string;
  viewAllHref?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 14px",
          borderBottom: "1px solid #d8dde6",
          gap: 10,
        }}
      >
        <ObjectIcon entity={entity} size="small" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#080707" }}>
            {title} ({items.length})
          </div>
        </div>
        {newHref && (
          <Link
            href={newHref}
            title="New"
            style={{
              border: "1px solid #d8dde6",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 12,
              color: "#080707",
              textDecoration: "none",
              background: "#fff",
            }}
          >
            New
          </Link>
        )}
      </div>

      <div>
        {items.length === 0 ? (
          <div style={{ padding: "16px", color: "#706e6b", fontSize: 12 }}>{emptyHint}</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #f3f3f3",
                fontSize: 13,
                color: "#080707",
              }}
            >
              {renderItem(item)}
            </div>
          ))
        )}
      </div>

      {viewAllHref && items.length > 0 && (
        <Link
          href={viewAllHref}
          style={{
            display: "block",
            textAlign: "center",
            padding: "8px",
            fontSize: 12,
            color: "#1589ee",
            textDecoration: "none",
            borderTop: "1px solid #f3f3f3",
          }}
        >
          View All
        </Link>
      )}
    </div>
  );
}
