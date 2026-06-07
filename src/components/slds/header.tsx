"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ObjectIcon } from "./icon";
import { AppLauncher } from "./app-launcher";
import { GlobalSearch } from "./global-search";

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
  { label: "Events", href: "/events", entity: "Event" },
  { label: "Program Plans", href: "/program-plans", entity: "ProgramPlan" },
  { label: "Drafts", href: "/drafts", entity: "Draft" },
  { label: "Offers", href: "/offers", entity: "Offer" },
  { label: "Settlements", href: "/settlements", entity: "Settlement" },
  { label: "Fees", href: "/fees", entity: "Fee" },
  { label: "Emails", href: "/emails", entity: "Email" },
  { label: "SMS", href: "/sms", entity: "Sms" },
  { label: "Templates", href: "/email-templates", entity: "Email" },
  { label: "Integrations", href: "/integrations", entity: "Settings" },
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
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Row 1 — minimal: small left app badge, centered search, right utility icons */}
      <div className="sf-global-bar">
        <Link href="/dashboard" className="sf-app-badge" title={appName}>
          <span className="sf-app-badge-icon" aria-hidden="true" />
        </Link>

        <div className="sf-search-wrap">
          <GlobalSearch />
        </div>

        <div className="sf-global-utilities">
          <Link href="/leads" className="sf-util-btn" title="Favorites">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#favorite" />
            </svg>
          </Link>
          <Link href="/leads" className="sf-util-btn sf-util-btn-chev" title="Favorites list">
            <svg className="sf-util-icon-small" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#down" />
            </svg>
          </Link>
          <div style={{ position: "relative" }}>
            <button
              className="sf-util-btn"
              title="Create new..."
              onClick={() => setQuickOpen((o) => !o)}
            >
              <svg className="sf-util-icon" aria-hidden="true">
                <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#add" />
              </svg>
            </button>
            {quickOpen && (
              <div className="sf-profile-menu" style={{ position: "absolute", top: 36, right: 0, minWidth: 200 }}>
                <div className="sf-profile-name">Create New</div>
                <Link href="/leads/new" className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ Lead</Link>
                <Link href="/accounts/new" className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ Account</Link>
                <Link href="/contacts/new" className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ Contact</Link>
                <Link href="/opportunities/new" className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ Opportunity</Link>
                <Link href="/cases/new" className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ Case</Link>
                <Link href="/tasks/new" className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ Task</Link>
                <Link href="/events/new" className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ Event</Link>
              </div>
            )}
          </div>
          <a
            href="https://www.lightningdesignsystem.com/"
            target="_blank"
            rel="noreferrer"
            className="sf-util-btn"
            title="Help"
          >
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#question_mark" />
            </svg>
          </a>
          <Link href="/settings" className="sf-util-btn" title="Setup">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#setup" />
            </svg>
          </Link>
          <div style={{ position: "relative" }}>
            <button
              className="sf-util-btn"
              title="Notifications"
              onClick={() => setNotificationsOpen((o) => !o)}
            >
              <svg className="sf-util-icon" aria-hidden="true">
                <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#notification" />
              </svg>
            </button>
            {notificationsOpen && (
              <div className="sf-profile-menu" style={{ position: "absolute", top: 36, right: 0, minWidth: 280 }}>
                <div className="sf-profile-name">Notifications</div>
                <div style={{ padding: "16px", color: "#706e6b", fontSize: 12 }}>
                  You&apos;re all caught up.
                </div>
              </div>
            )}
          </div>
          <button
            className="sf-avatar-btn"
            onClick={() => setProfileOpen((o) => !o)}
            title={userName ?? "Profile"}
          >
            <span className="sf-avatar">{userInitials}</span>
          </button>
          {profileOpen && (
            <SldsProfileMenu
              userName={userName}
              userInitials={userInitials}
              onClose={() => setProfileOpen(false)}
            />
          )}
        </div>
      </div>

      {/* App Launcher modal */}
      <AppLauncher open={launcherOpen} onClose={() => setLauncherOpen(false)} />

      {/* Row 2 — app launcher waffle + app name + horizontal tab nav */}
      <div className="sf-nav-bar">
        <button
          className="sf-app-launcher"
          title="App Launcher"
          aria-label="App Launcher"
          onClick={() => setLauncherOpen(true)}
        >
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

const DENSITY_KEY = "sf:displayDensity";
type Density = "comfy" | "compact";

function SldsProfileMenu({
  userName,
  userInitials,
  onClose,
}: {
  userName?: string;
  userInitials: string;
  onClose: () => void;
}) {
  const [density, setDensity] = useState<Density>("compact");

  useEffect(() => {
    try {
      const v = localStorage.getItem(DENSITY_KEY);
      if (v === "comfy" || v === "compact") setDensity(v);
    } catch {}
  }, []);

  const pick = (next: Density) => {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {}
  };

  return (
    <div
      className="sf-profile-menu sf-profile-menu-wide"
      role="menu"
      style={{ minWidth: 280, padding: 0 }}
    >
      <div className="sf-profile-header">
        <span className="sf-avatar sf-profile-header-avatar">{userInitials}</span>
        <div className="sf-profile-header-body">
          <div className="sf-profile-header-name">{userName ?? "User"}</div>
          <div className="sf-profile-header-org">coastaldebt.my.salesforce.com</div>
          <div className="sf-profile-header-links">
            <Link href="/my-settings/personal-information" onClick={onClose}>
              Settings
            </Link>
            <span className="sf-profile-header-sep">|</span>
            <button
              type="button"
              className="sf-profile-header-link-btn"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      <div className="sf-profile-section">
        <div className="sf-profile-section-title">Display Density</div>
        <label className="sf-profile-radio">
          <input
            type="radio"
            name="sf-density"
            value="comfy"
            checked={density === "comfy"}
            onChange={() => pick("comfy")}
          />
          <span>Comfy</span>
        </label>
        <label className="sf-profile-radio">
          <input
            type="radio"
            name="sf-density"
            value="compact"
            checked={density === "compact"}
            onChange={() => pick("compact")}
          />
          <span>Compact</span>
        </label>
      </div>

      <div className="sf-profile-section">
        <div className="sf-profile-section-title">Options</div>
        <a href="#" className="sf-profile-item" onClick={(e) => e.preventDefault()}>
          Switch to Salesforce Classic
        </a>
        <a href="#" className="sf-profile-item" onClick={(e) => e.preventDefault()}>
          Add Username
        </a>
      </div>
    </div>
  );
}
