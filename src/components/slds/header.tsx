"use client";

import Link from "next/link";
import { centerNavHref } from "@/lib/esign/center";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { AppLauncher } from "./app-launcher";
import { GlobalSearch } from "./global-search";
import { useOptionalPhone } from "@/components/call-center/provider";
import { FeedbackButton } from "@/components/slds/feedback-button";
import { ConsoleNav, readNavMode, setNavMode } from "@/components/slds/console-nav";
import { EditNavModal, applyNavPrefs, type NavItem } from "./edit-nav-modal";
import { avatarFor } from "@/lib/avatars";
import { NotificationsPanel, useNotificationsCount } from "@/components/notifications/notifications-panel";
import { canUsePermission, canViewNavigation } from "@/lib/navigation-access";

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
  { label: "Negotiations", href: "/negotiations", entity: "Debt" },
  { label: "Floor Manager Hub", href: "/floor-manager" },
  { label: "War Room", href: "/war-room" },
  { label: "Lenders", href: "/lenders" },
  { label: "Dashboards", href: "/dashboards", entity: "Dashboard" },
  { label: "Forecasting", href: "/forecasting", entity: "Opportunity" },
  { label: "Scoreboard", href: "/scoreboard" },
  { label: "Clients", href: "/clients", entity: "Client" },
  { label: "Creditors", href: "/creditors", entity: "Creditor" },
  { label: "Approvals", href: "/approvals", entity: "Case" },
  { label: "Events", href: "/events", entity: "Event" },
  { label: "Google Chat", href: "/google-chat" },
  { label: "Chatter", href: "/chatter", entity: "Lead" },
  { label: "Program Plans", href: "/program-plans", entity: "ProgramPlan" },
  { label: "Drafts", href: "/drafts", entity: "Draft" },
  { label: "Offers", href: "/offers", entity: "Offer" },
  { label: "Settlements", href: "/settlements", entity: "Settlement" },
  { label: "Fees", href: "/fees", entity: "Fee" },
  { label: "Emails", href: "/emails", entity: "Email" },
  { label: "Email Center", href: "/email-center", entity: "Email" },
  { label: "SMS", href: "/sms", entity: "Sms" },
  { label: "Email Templates", href: "/email-templates", entity: "Email" },
  { label: "Files", href: "/files", entity: "ProgramPlan" },
  { label: "Integrations", href: "/integrations", entity: "Settings" },
  { label: "Dialer", href: "/dialer" },
  { label: "Call Center", href: "/call-center" },
  { label: "Marketing", href: "/marketing", entity: "Campaign" },
  { label: "E-Sign Center", href: "/sign-docs", entity: "ProgramPlan" },
  { label: "Campaigns", href: "/campaigns", entity: "Campaign" },
];

const CREATE_LINKS = [
  { href: "/leads/new", label: "Lead", permission: "Lead.Create" },
  { href: "/accounts/new", label: "Account", permission: "Account.Create" },
  { href: "/contacts/new", label: "Contact", permission: "Contact.Create" },
  { href: "/opportunities/new", label: "Opportunity", permission: "Opportunity.Create" },
  { href: "/cases/new", label: "Case", permission: "Case.Create" },
  { href: "/tasks/new", label: "Task", permission: "Task.Create" },
  { href: "/events/new", label: "Event", permission: "Event.Create" },
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
  preview = false,
  permissions = [],
}: {
  appName?: string;
  userInitials?: string;
  userName?: string;
  preview?: boolean;
  permissions?: string[];
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [morePos, setMorePos] = useState<{ top: number; right: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreContainerRef = useRef<HTMLSpanElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [editNavOpen, setEditNavOpen] = useState(false);
  const [visibleTabs, setVisibleTabs] = useState<NavItem[]>(TABS);
  const [navMode, setNavModeState] = useState<"console" | "standard">("standard");
  const pathname = usePathname();
  const phone = useOptionalPhone();
  const allowedTabs = visibleTabs.filter(t => canViewNavigation(t.href, permissions) && (!phone || t.href !== "/floor-manager" || phone.data?.sales?.access.floor)).map(t => t.href === "/call-center" && phone?.data?.sales?.access ? { ...t, href: phone.data.sales.access.home, label: phone.data.sales.access.floor ? "Live Floor" : phone.data.sales.access.closer ? "Closer Desk" : "Opener Desk" } : t);
  const currentHref = centerNavHref(pathname);
  const activeHref = allowedTabs
    .filter(t => currentHref === t.href || (t.href !== "/dashboard" && currentHref.startsWith(`${t.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const createLinks = CREATE_LINKS.filter(item => canUsePermission(permissions, item.permission));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setVisibleTabs(preview ? TABS : applyNavPrefs(TABS));
      setNavModeState(preview ? "standard" : readNavMode());
    });
    return () => cancelAnimationFrame(frame);
  }, [preview]);

  useEffect(() => {
    if (!moreOpen) return;
    const outside = (event: MouseEvent) => {
      if (!moreContainerRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMoreOpen(false); moreBtnRef.current?.focus(); }
    };
    const resize = () => setMoreOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
    };
  }, [moreOpen]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const revealActive = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;
      const bounds = nav.getBoundingClientRect(), tab = active.getBoundingClientRect();
      if (tab.left < bounds.left) nav.scrollLeft -= bounds.left - tab.left;
      else if (tab.right > bounds.right) nav.scrollLeft += tab.right - bounds.right;
    };
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname, navMode, visibleTabs]);

  return (
    <header className="sf-header" aria-label="Coastal CRM">
      {/* Row 1 — minimal: small left app badge, centered search, right utility icons */}
      <div className="sf-global-bar">
        <Link href={canViewNavigation("/dashboard", permissions) ? "/dashboard" : allowedTabs[0]?.href ?? "/my-settings/personal-information"} className="sf-app-badge" title="Coastal CRM home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/coastal-debt-logo.svg"
            alt="Coastal Debt Resolve"
            width={220}
            height={40}
            className="sf-app-badge-icon"
          />
        </Link>

        <div className="sf-search-wrap">
          <GlobalSearch />
        </div>

        <div className="sf-global-utilities">
          <Link href={canViewNavigation("/leads", permissions) ? "/leads" : allowedTabs[0]?.href ?? "/my-settings/personal-information"} className="sf-util-btn" title="Favorites">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#favorite" />
            </svg>
          </Link>
          <Link href={canViewNavigation("/leads", permissions) ? "/leads" : allowedTabs[0]?.href ?? "/my-settings/personal-information"} className="sf-util-btn sf-util-btn-chev" title="Favorites list">
            <svg className="sf-util-icon-small" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#down" />
            </svg>
          </Link>
          {createLinks.length > 0 && <div style={{ position: "relative" }}>
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
                {createLinks.map(item => <Link key={item.href} href={item.href} className="sf-profile-item" onClick={() => setQuickOpen(false)}>+ {item.label}</Link>)}
              </div>
            )}
          </div>}
          <FeedbackButton />
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
          {(canUsePermission(permissions, "User.View") || canUsePermission(permissions, "Permission.Manage") || canUsePermission(permissions, "Integration.Manage")) && <Link href="/settings" className="sf-util-btn" title="Setup">
            <svg className="sf-util-icon" aria-hidden="true">
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#setup" />
            </svg>
          </Link>}
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
              navMode={navMode}
              preview={preview}
            />
          )}
        </div>
      </div>

      {/* App Launcher modal */}
      <AppLauncher open={launcherOpen} onClose={() => setLauncherOpen(false)} permissions={permissions} />

      {/* Row 2 — console workspace bar OR the standard horizontal tab nav */}
      {navMode === "console" ? (
        <ConsoleNav appName={`${appName} Console`} objects={allowedTabs.map((t) => ({ label: t.label, href: t.href }))} />
      ) : (
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
        <Link href={canViewNavigation("/dashboard", permissions) ? "/dashboard" : allowedTabs[0]?.href ?? "/my-settings/personal-information"} className="sf-app-name">{appName}</Link>
        <nav ref={navRef} className="sf-tab-nav" aria-label="Main navigation">
          {allowedTabs.slice(0, 11).map((t) => {
            const active = activeHref === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`sf-tab ${active ? "sf-tab-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {t.label}
                {t.href !== "/dashboard" && t.href !== "/calculator" && <svg className="sf-tab-chev" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#down" />
                </svg>}
              </Link>
            );
          })}
        </nav>
          {allowedTabs.length > 11 && (
            <span ref={moreContainerRef} className="sf-nav-overflow">
              <button
                ref={moreBtnRef}
                aria-expanded={moreOpen}
                aria-controls="crm-more-navigation"
                className={`sf-tab ${allowedTabs.slice(11).some((t) => t.href === activeHref) ? "sf-tab-active" : ""}`}
                style={{ background: moreOpen ? "#f3f2f2" : undefined }}
                onClick={() => {
                  setMoreOpen((v) => {
                    if (!v && moreBtnRef.current) {
                      const r = moreBtnRef.current.getBoundingClientRect();
                      setMorePos({ top: r.bottom, right: Math.max(8, window.innerWidth - r.right) });
                    }
                    return !v;
                  });
                }}
              >
                More
                <svg className="sf-tab-chev" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#down" />
                </svg>
              </button>
              {moreOpen && morePos && (
                <span
                  id="crm-more-navigation"
                  role="navigation"
                  aria-label="More navigation"
                  // Fixed position (not absolute) so the nav's overflow-x:auto
                  // scroll container doesn't clip the dropdown below the bar.
                  style={{ position: "fixed", top: morePos.top, right: morePos.right, zIndex: 9100, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", minWidth: 200, maxHeight: "70vh", overflowY: "auto", display: "block", padding: "4px 0" }}
                >
                  {allowedTabs.slice(11).map((t) => (
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
        {!preview && <button
          className="sf-tab-edit"
          title="Edit tabs"
          onClick={() => setEditNavOpen(true)}
        >
          <svg className="sf-util-icon" aria-hidden="true">
            <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#edit" />
          </svg>
        </button>}
      </div>
      )}
      <div className="sf-decor-band" aria-hidden="true" />

      <EditNavModal
        open={editNavOpen}
        onClose={() => setEditNavOpen(false)}
        allTabs={TABS.filter(t => canViewNavigation(t.href, permissions))}
        onSaved={() => setVisibleTabs(applyNavPrefs(TABS))}
      />
    </header>
  );
}

function SldsProfileMenu({
  userName,
  userInitials,
  onClose,
  navMode,
  preview,
}: {
  userName?: string;
  userInitials: string;
  onClose: () => void;
  navMode: "console" | "standard";
  preview: boolean;
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
      {!preview && <button type="button" className="sf-profile-item sf-nav-mode-switch" onClick={() => setNavMode(navMode === "console" ? "standard" : "console")}>
        Switch to {navMode === "console" ? "Standard" : "Console"} view
      </button>}
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
