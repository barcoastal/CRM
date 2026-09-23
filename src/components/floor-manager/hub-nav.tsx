"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/floor-manager", label: "Live Floor" },
  { href: "/floor-manager/meetings", label: "Meetings" },
  { href: "/floor-manager/performance", label: "Closer Dashboard" },
  { href: "/floor-manager/on-call", label: "Closers On Call" },
  { href: "/floor-manager/closers", label: "Closer Setup" },
  { href: "/floor-manager/scoreboard", label: "Scoreboard & TV" },
];

export function FloorManagerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Floor Manager Hub" className="fm-hub-nav">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
