"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ObjectIcon } from "./icon";

interface TabItem {
  label: string;
  href: string;
  entity: string;
}

const TABS: TabItem[] = [
  { label: "Home", href: "/dashboard", entity: "Dashboard" },
  { label: "Leads", href: "/leads", entity: "Lead" },
  { label: "Accounts", href: "/accounts", entity: "Account" },
  { label: "Contacts", href: "/contacts", entity: "Contact" },
  { label: "Opportunities", href: "/opportunities", entity: "Opportunity" },
  { label: "Clients", href: "/clients", entity: "Client" },
  { label: "Creditors", href: "/creditors", entity: "Creditor" },
  { label: "Cases", href: "/cases", entity: "Case" },
  { label: "Tasks", href: "/tasks", entity: "Task" },
  { label: "Dialer", href: "/dialer", entity: "Dialer" },
  { label: "Campaigns", href: "/campaigns", entity: "Campaign" },
  { label: "Reports", href: "/reports", entity: "Report" },
];

export function SldsTabNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        height: 38,
        background: "#fff",
        borderBottom: "1px solid #c9c9c9",
        display: "flex",
        alignItems: "stretch",
        padding: "0 16px",
        overflowX: "auto",
        whiteSpace: "nowrap",
        position: "sticky",
        top: 48,
        zIndex: 8000,
      }}
    >
      {TABS.map((t) => {
        const active =
          pathname === t.href ||
          (t.href !== "/dashboard" && pathname.startsWith(t.href));
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              color: active ? "#181818" : "#444444",
              fontSize: 13,
              fontWeight: active ? 700 : 400,
              textDecoration: "none",
              borderBottom: active ? "3px solid #0176d3" : "3px solid transparent",
              borderRight: "1px solid #c9c9c9",
              borderLeft: "1px solid transparent",
              background: active ? "#fff" : "transparent",
              position: "relative",
            }}
          >
            <ObjectIcon entity={t.entity} size="x-small" />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
