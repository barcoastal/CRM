import Link from "next/link";
import type { ReactNode } from "react";

const TABS = [
  { href: "/email-center", label: "Inbox" },
  { href: "/email-center/campaigns", label: "Campaigns" },
  { href: "/email-center/flows", label: "Flows" },
  { href: "/email-center/segments", label: "Segments" },
  { href: "/email-templates", label: "Templates" },
  { href: "/email-center/reports", label: "Reports" },
  { href: "/email-center/domain-health", label: "Domain Health" },
];

export default function EmailCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", height: "calc(100vh - 90px)", background: "#f3f3f3" }}>
      <nav
        style={{
          width: 180,
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid #e5e5e5",
          padding: "12px 0",
        }}
      >
        <div style={{ padding: "0 16px 10px", fontSize: 15, fontWeight: 700, color: "#181818" }}>
          Email Center
        </div>
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: "block",
              padding: "7px 16px",
              fontSize: 13,
              color: "#181818",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>{children}</main>
    </div>
  );
}
