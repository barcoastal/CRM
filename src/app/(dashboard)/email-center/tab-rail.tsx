"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ d, filled }: { d: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v7H2v-7l3.5-7z",
  campaigns: "M3 11l18-7-7 18-2.5-7.5L3 11z",
  flows: "M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6M6 3a2 2 0 1 0 0.001 0zM18 21a2 2 0 1 0 0.001 0z",
  segments: "M21 12a9 9 0 1 1-9-9v9h9z",
  templates: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6",
  reports: "M3 21h18M7 21V9m5 12V4m5 17v-9",
  domain: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  sms: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};

type Tab = { href: string; label: string; icon: string; soon?: string };

const TABS: Tab[] = [
  { href: "/email-center", label: "Inbox", icon: "inbox" },
  { href: "/email-center/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/email-center/flows", label: "Flows", icon: "flows" },
  { href: "/email-center/segments", label: "Segments", icon: "segments" },
  { href: "/email-center/templates", label: "Templates", icon: "templates" },
  { href: "/email-center/reports", label: "Reports", icon: "reports" },
  { href: "/email-center/domain-health", label: "Domain Health", icon: "domain" },
];

const SMS_TABS: Tab[] = [
  { href: "/email-center/sms/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/email-center/sms/flows", label: "Flows", icon: "flows" },
  { href: "/email-center/sms/reports", label: "Reports", icon: "reports" },
];

export function TabRail() {
  const pathname = usePathname();
  return (
    <nav className="ec-rail">
      <div className="ec-rail-brand">
        <div className="ec-rail-brand-mark">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 6h16v12H4z M4 7l8 6 8-6" />
          </svg>
        </div>
        <div>
          <div className="ec-rail-brand-name">Email Center</div>
          <div className="ec-rail-brand-sub">Coastal Debt</div>
        </div>
      </div>
      <div className="ec-rail-section">Messaging</div>
      {TABS.map((t) => {
        const active =
          t.href === "/email-center"
            ? pathname === "/email-center"
            : pathname.startsWith(t.href) && !pathname.startsWith("/email-center/sms");
        return (
          <Link key={t.href} href={t.href} className={`ec-tab${active ? " ec-tab-active" : ""}`}>
            <Icon d={ICONS[t.icon]} />
            <span>{t.label}</span>
            {t.soon ? <span className="ec-tab-soon">{t.soon}</span> : null}
          </Link>
        );
      })}
      <div className="ec-rail-section">SMS</div>
      {SMS_TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`ec-tab${active ? " ec-tab-active" : ""}`}>
            <Icon d={ICONS[t.icon]} />
            <span>{t.label}</span>
          </Link>
        );
      })}
      <div className="ec-rail-foot">Full suite live</div>
    </nav>
  );
}
