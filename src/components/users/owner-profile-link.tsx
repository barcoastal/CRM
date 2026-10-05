import Link from "next/link";

/** Return the anchor itself so list cells preserve the owner destination. */
export function ownerProfileLink(userId: string | null | undefined, label: string) {
  return userId
    ? <Link key="owner" href={`/settings/users/${encodeURIComponent(userId)}`} className="sf-row-link" style={{ color: "#0176d3" }}>{label || "View owner"}</Link>
    : label || "—";
}
