"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ObjectIcon } from "./icon";

interface TabItem {
  label: string;
  href: string;
  entity?: string;
}

const TABS: TabItem[] = [
  { label: "Home", href: "/dashboard" },
  { label: "Leads", href: "/leads", entity: "Lead" },
  { label: "Accounts", href: "/accounts", entity: "Account" },
  { label: "Contacts", href: "/contacts", entity: "Contact" },
  { label: "Opportunities", href: "/opportunities", entity: "Opportunity" },
  { label: "Clients", href: "/clients", entity: "Client" },
  { label: "Creditors", href: "/creditors", entity: "Creditor" },
  { label: "Cases", href: "/cases", entity: "Case" },
  { label: "Tasks", href: "/tasks", entity: "Task" },
  { label: "Dialer", href: "/dialer" },
  { label: "Campaigns", href: "/campaigns", entity: "Campaign" },
  { label: "Reports", href: "/reports" },
];

/**
 * Real Salesforce Lightning header — white single-row bar with:
 *  - tiny global search at top
 *  - then app launcher + app name + tabs all on the same row below
 *  - decorative blue diagonal pattern band below
 *
 * Modeled directly from cdcrm.lightning.force.com screenshots.
 */
export function SldsHeader({
  appName = "Sales Operations",
  userInitials = "U",
  userName,
}: {
  appName?: string;
  userInitials?: string;
  userName?: string;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Row 1 — minimal: small left app badge, centered search, right utility icons */}
      <div className="sf-global-bar">
        <Link href="/dashboard" className="sf-app-badge" title={appName}>
          <span className="sf-app-badge-icon" aria-hidden="true" />
        </Link>

        <div className="sf-search-wrap">
          <div className="sf-search">
            <svg className="sf-search-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#search" />
            </svg>
            <input className="sf-search-input" placeholder="Search..." />
          </div>
        </div>

        <div className="sf-global-utilities">
          <button className="sf-util-btn" title="Favorites">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#favorite" />
            </svg>
          </button>
          <button className="sf-util-btn sf-util-btn-chev" title="Favorites list">
            <svg className="sf-util-icon-small" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#down" />
            </svg>
          </button>
          <button className="sf-util-btn" title="Add">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#add" />
            </svg>
          </button>
          <button className="sf-util-btn" title="Help">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#question_mark" />
            </svg>
          </button>
          <button className="sf-util-btn" title="Setup">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#setup" />
            </svg>
          </button>
          <button className="sf-util-btn" title="Notifications">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#notification" />
            </svg>
          </button>
          <button
            className="sf-avatar-btn"
            onClick={() => setProfileOpen((o) => !o)}
            title={userName ?? "Profile"}
          >
            <span className="sf-avatar">{userInitials}</span>
          </button>
          {profileOpen && (
            <div className="sf-profile-menu">
              {userName && <div className="sf-profile-name">{userName}</div>}
              <Link href="/settings" className="sf-profile-item" onClick={() => setProfileOpen(false)}>
                Settings
              </Link>
              <button
                className="sf-profile-item"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — app launcher waffle + app name + horizontal tab nav */}
      <div className="sf-nav-bar">
        <button className="sf-app-launcher" title="App Launcher" aria-label="App Launcher">
          <span className="sf-waffle" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
          </span>
        </button>
        <Link href="/dashboard" className="sf-app-name">{appName}</Link>
        <nav className="sf-tab-nav">
          {TABS.map((t) => {
            const active =
              pathname === t.href || (t.href !== "/dashboard" && pathname.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`sf-tab ${active ? "sf-tab-active" : ""}`}
              >
                {t.label}
                <svg className="sf-tab-chev" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#down" />
                </svg>
              </Link>
            );
          })}
        </nav>
        <button className="sf-tab-edit" title="Edit tabs">
          <svg className="sf-util-icon" aria-hidden="true">
            <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#edit" />
          </svg>
        </button>
      </div>

      {/* Row 3 — decorative blue diagonal banner */}
      <div className="sf-decor-band" aria-hidden="true" />
    </>
  );
}
