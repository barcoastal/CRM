"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ObjectIcon } from "./icon";
import { AppLauncher } from "./app-launcher";
import { GlobalSearch } from "./global-search";
import { EditNavModal, applyNavPrefs, type NavItem } from "./edit-nav-modal";
import { avatarFor } from "@/lib/avatars";
import { NotificationsPanel, useNotificationsCount } from "@/components/notifications/notifications-panel";

/** Circular user avatar — playful illustrated portrait, initials behind it. */
function SfAvatar({ seed, initials, className }: { seed?: string; initials: string; className?: string }) {
  return (
    <span className={`sf-avatar${className ? ` ${className}` : ""}`} style={{ position: "relative", overflow: "hidden" }}>
      {initials}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarFor(seed ?? initials)}
        alt={initials}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    </span>
  );
}

interface TabItem {
  label: string;
  href: string;
  entity?: string;
}

const TABS: TabItem[] = [
  // SF Debt Settlement app tab order - the first tabs must read exactly like
  // the org so daily SF users feel at home: Home, Payment Calculator, Tasks,
  // Leads, Accounts, Contacts, Opportunities, Payment Processors, Cases,
  // Application Logs, Reports. Everything after lands under More.
  { label: "Home", href: "/dashboard" },
  { label: "Payment Calculator", href: "/calculator", entity: "ProgramPlan" },
  { label: "Tasks", href: "/tasks", entity: "Task" },
  { label: "Leads", href: "/leads", entity: "Lead" },
  { label: "Accounts", href: "/accounts", entity: "Account" },
  { label: "Contacts", href: "/contacts", entity: "Contact" },
  { label: "Opportunities", href: "/opportunities", entity: "Opportunity" },
  { label: "Payment Processors", href: "/integrations/processor-log", entity: "Settings" },
  { label: "Cases", href: "/cases", entity: "Case" },
  { label: "Application Logs", href: "/settings/app-log", entity: "Settings" },
  { label: "Reports", href: "/reports" },
  { label: "Dashboards", href: "/dashboards", entity: "Dashboard" },
  { label: "Forecasting", href: "/forecasting", entity: "Opportunity" },
  { label: "Clients", href: "/clients", entity: "Client" },
  { label: "Creditors", href: "/creditors", entity: "Creditor" },
  { label: "Approvals", href: "/approvals", entity: "Case" },
  { label: "Automation", href: "/automation/flows", entity: "Case" },
  { label: "Events", href: "/events", entity: "Event" },
  { label: "Chatter", href: "/chatter", entity: "Lead" },
  { label: "Program Plans", href: "/program-plans", entity: "ProgramPlan" },
  { label: "Contract Templates", href: "/contracts/templates", entity: "Opportunity" },
  { label: "Drafts", href: "/drafts", entity: "Draft" },
  { label: "Offers", href: "/offers", entity: "Offer" },
  { label: "Settlements", href: "/settlements", entity: "Settlement" },
  { label: "Fees", href: "/fees", entity: "Fee" },
  { label: "Emails", href: "/emails", entity: "Email" },
  { label: "SMS", href: "/sms", entity: "Sms" },
  { label: "Templates", href: "/email-templates", entity: "Email" },
  { label: "Files", href: "/files", entity: "ProgramPlan" },
  { label: "E-Sign", href: "/envelopes", entity: "ProgramPlan" },
  { label: "Integrations", href: "/integrations", entity: "Settings" },
  { label: "Dialer", href: "/dialer" },
  { label: "Marketing", href: "/marketing", entity: "Campaign" },
  { label: "Sign Docs", href: "/sign-docs", entity: "ProgramPlan" },
  { label: "Campaigns", href: "/campaigns", entity: "Campaign" },
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
  appName = "Debt Settlement",
  userInitials = "U",
  userName,
}: {
  appName?: string;
  userInitials?: string;
  userName?: string;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [editNavOpen, setEditNavOpen] = useState(false);
  const [visibleTabs, setVisibleTabs] = useState<NavItem[]>(TABS);
  const pathname = usePathname();

  useEffect(() => {
    setVisibleTabs(applyNavPrefs(TABS));
  }, []);

  return (
    <>
      {/* Row 1 — minimal: small left app badge, centered search, right utility icons */}
      <div className="sf-global-bar">
        <Link href="/dashboard" className="sf-app-badge" title={appName}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/mark-white.svg"
            alt="Coastal CRM"
            className="sf-app-badge-icon"
          />
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
          <NotificationsBell
            open={notificationsOpen}
            onToggle={() => setNotificationsOpen((o) => !o)}
            onClose={() => setNotificationsOpen(false)}
          />
          <button
            className="sf-avatar-btn"
            onClick={() => setProfileOpen((o) => !o)}
            title={userName ?? "Profile"}
          >
            <SfAvatar seed={userName} initials={userInitials} />
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
          {visibleTabs.slice(0, 11).map((t) => {
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
          {visibleTabs.length > 11 && (
            <span style={{ position: "relative", display: "inline-flex", alignItems: "stretch" }}>
              <button
                className={`sf-tab ${visibleTabs.slice(11).some((t) => pathname.startsWith(t.href)) ? "sf-tab-active" : ""}`}
                style={{ background: moreOpen ? "#f3f2f2" : undefined, border: 0, cursor: "pointer", height: "100%", display: "inline-flex", alignItems: "center" }}
                onClick={() => setMoreOpen((v) => !v)}
              >
                More
                <svg className="sf-tab-chev" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#down" />
                </svg>
              </button>
              {moreOpen && (
                <span
                  style={{ position: "absolute", top: "100%", right: 0, zIndex: 9100, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", minWidth: 200, maxHeight: 480, overflowY: "auto", display: "block", padding: "4px 0" }}
                  onMouseLeave={() => setMoreOpen(false)}
                >
                  {visibleTabs.slice(11).map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => setMoreOpen(false)}
                      style={{ display: "block", padding: "7px 16px", fontSize: 13, color: "#181818", textDecoration: "none" }}
                    >
                      {t.label}
                    </Link>
                  ))}
                </span>
              )}
            </span>
          )}
        </nav>
        <button
          className="sf-tab-edit"
          title="Edit tabs"
          onClick={() => setEditNavOpen(true)}
        >
          <svg className="sf-util-icon" aria-hidden="true">
            <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#edit" />
          </svg>
        </button>
      </div>

      <EditNavModal
        open={editNavOpen}
        onClose={() => setEditNavOpen(false)}
        allTabs={TABS}
        onSaved={() => setVisibleTabs(applyNavPrefs(TABS))}
      />
    </>
  );
}

function SldsProfileMenu({
  userName,
  userInitials,
  onClose,
}: {
  userName?: string;
  userInitials: string;
  onClose: () => void;
}) {
  return (
    <div
      className="sf-profile-menu sf-profile-menu-wide"
      role="menu"
      style={{ minWidth: 280, padding: 0 }}
    >
      <div className="sf-profile-header">
        <SfAvatar seed={userName} initials={userInitials} className="sf-profile-header-avatar" />
        <div className="sf-profile-header-body">
          <div className="sf-profile-header-name">{userName ?? "User"}</div>
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
    </div>
  );
}

/**
 * Bell-icon button + dropdown. Splits out so we can wire the unread count
 * (kept up to date via the polling useNotificationsCount hook) to the badge
 * even while the dropdown is closed.
 */
function NotificationsBell({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { unreadCount, refetch } = useNotificationsCount();
  return (
    <div style={{ position: "relative" }}>
      <button
        className="sf-util-btn"
        title="Notifications"
        onClick={() => {
          onToggle();
          // Refresh count whenever the user opens the dropdown.
          if (!open) refetch();
        }}
        style={{ position: "relative" }}
      >
        <svg className="sf-util-icon" aria-hidden="true">
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#notification" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread notifications`}
            style={{
              position: "absolute",
              top: 1,
              right: 1,
              minWidth: 14,
              height: 14,
              padding: "0 4px",
              borderRadius: 7,
              background: "#c23934",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              border: "1.5px solid #fff",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationsPanel onClose={onClose} onCountChange={refetch} />}
    </div>
  );
}
