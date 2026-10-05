"use client";

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import type { InlineEditCellProps } from "./inline-edit-cell";

/** Keep edit controls outside record links in both list implementations. */
export function RecordLinkCell({ children, href }: { children?: ReactNode; href: string }) {
  // Children resolves deferred RSC nodes before inspecting their element props.
  const nodes = Children.toArray(children);
  const child = nodes.length === 1 ? nodes[0] : undefined;
  if (isValidElement<{ href?: string }>(child) && typeof child.props.href === "string") {
    return child;
  }
  // RSC can deliver the client component with a lazy type. Its serialized
  // inline-edit props are stable, unlike comparing the component's type.
  if (
    isValidElement<Partial<InlineEditCellProps>>(child) &&
    typeof child.props.entity === "string" &&
    typeof child.props.recordId === "string" &&
    typeof child.props.config?.field === "string"
  ) {
    return cloneElement(child, { recordHref: href });
  }

  return (
    <Link href={href} className="sf-row-link" style={{ color: "#0176d3", textDecoration: "none" }}>
      {children}
    </Link>
  );
}
