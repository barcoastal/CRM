"use client";

import { cloneElement, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import type { InlineEditCellProps } from "./inline-edit-cell";

/** Keep edit controls outside record links in both list implementations. */
export function RecordLinkCell({ children, href }: { children?: ReactNode; href: string }) {
  // RSC can deliver the client component with a lazy type. Its serialized
  // inline-edit props are stable, unlike comparing the component's type.
  if (
    isValidElement<Partial<InlineEditCellProps>>(children) &&
    typeof children.props.entity === "string" &&
    typeof children.props.recordId === "string" &&
    typeof children.props.config?.field === "string"
  ) {
    return cloneElement(children, { recordHref: href });
  }

  return (
    <Link href={href} className="sf-row-link" style={{ color: "#0176d3", textDecoration: "none" }}>
      {children}
    </Link>
  );
}
