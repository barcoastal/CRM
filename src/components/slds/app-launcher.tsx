"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ObjectIcon } from "./icon";

/**
 * Salesforce-style App Launcher modal.
 * Triggered by the 9-dot waffle in the header. Shows two sections:
 *  - Apps (top): high-level workspaces — pre-built bundles of tabs
 *  - Items (bottom): every individual object (Accounts, Leads, Cases, etc.)
 * Has a search input that filters both.
 */

interface AppTile {
  label: string;
  href: string;
  description: string;
}

interface ItemTile {
  label: string;
  href: string;
  entity: string;
}

const APPS: AppTile[] = [
  { label: "Sales Operations", href: "/dashboard", description: "Full pipeline + reports" },
  { label: "Dashboards", href: "/dashboards", description: "KPIs and charts" },
  { label: "Sales Console", href: "/opportunities", description: "Closer workspace" },
  { label: "Forecasting", href: "/forecasting", description: "Pipeline by category + quota" },
  { label: "Customer Service", href: "/cases", description: "Cases + case feed" },
  { label: "Debt Negotiation", href: "/offers", description: "Offers + settlements" },
  { label: "BackOffice", href: "/program-plans", description: "Plans, drafts, fees" },
  { label: "Marketing", href: "/marketing", description: "Inbound sources + postbacks" },
  { label: "Mass Email", href: "/emails/mass", description: "Bulk send + open/click tracking" },
  { label: "Sign Docs", href: "/sign-docs", description: "Contracts, templates, signatures" },
  { label: "Dialer", href: "/dialer", description: "Power dialer + dispositions" },
  { label: "AI Dialer", href: "/ai-dialer", description: "AI qualification + meeting booking" },
  { label: "Approvals", href: "/approvals", description: "Review and submit approval requests" },
  { label: "Admin", href: "/integrations", description: "Integrations + users" },
  { label: "Chatter", href: "/chatter", description: "Team feeds + groups + mentions" },
  { label: "Files", href: "/files", description: "Central content library" },
];

const ITEMS: ItemTile[] = [
  { label: "Home", href: "/dashboard", entity: "Dashboard" },
  { label: "Dashboards", href: "/dashboards", entity: "Dashboard" },
  { label: "Leads", href: "/leads", entity: "Lead" },
  { label: "Accounts", href: "/accounts", entity: "Account" },
  { label: "Opportunities", href: "/opportunities", entity: "Opportunity" },
  { label: "Forecasting", href: "/forecasting", entity: "Opportunity" },
  { label: "Clients", href: "/clients", entity: "Client" },
  { label: "Creditors", href: "/creditors", entity: "Creditor" },
  { label: "Cases", href: "/cases", entity: "Case" },
  { label: "Tasks", href: "/tasks", entity: "Task" },
  { label: "Approvals", href: "/approvals", entity: "Case" },
  { label: "Flows", href: "/automation/flows", entity: "Case" },
  { label: "Events", href: "/events", entity: "Event" },
  { label: "Program Plans", href: "/program-plans", entity: "ProgramPlan" },
  { label: "Drafts", href: "/drafts", entity: "Draft" },
  { label: "Offers", href: "/offers", entity: "Offer" },
  { label: "Settlements", href: "/settlements", entity: "Settlement" },
  { label: "Fees", href: "/fees", entity: "Fee" },
  { label: "Emails", href: "/emails", entity: "Email" },
  { label: "Mass Email", href: "/emails/mass", entity: "Email" },
  { label: "SMS", href: "/sms", entity: "Sms" },
  { label: "Email Templates", href: "/email-templates", entity: "Email" },
  { label: "Files", href: "/files", entity: "ProgramPlan" },
  { label: "Sign Docs", href: "/sign-docs", entity: "ProgramPlan" },
  { label: "E-Sign Templates", href: "/templates/esign", entity: "ProgramPlan" },
  { label: "Envelopes", href: "/envelopes", entity: "ProgramPlan" },
  { label: "Integrations", href: "/integrations", entity: "Settings" },
  { label: "Dialer", href: "/dialer", entity: "Dialer" },
  { label: "AI Dialer", href: "/ai-dialer", entity: "Dialer" },
  { label: "Campaigns", href: "/campaigns", entity: "Campaign" },
  { label: "Marketing", href: "/marketing", entity: "Campaign" },
  { label: "Engagement", href: "/marketing/engagement", entity: "Campaign" },
  { label: "Inbound Sources", href: "/marketing/sources", entity: "Campaign" },
  { label: "Postback Endpoints", href: "/marketing/postbacks", entity: "Campaign" },
  { label: "Reports", href: "/reports", entity: "Report" },
  { label: "Notifications", href: "/notifications", entity: "Settings" },
  { label: "Chatter", href: "/chatter", entity: "Lead" },
  { label: "Groups", href: "/chatter/groups", entity: "Lead" },
];

export function AppLauncher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  // Close on Esc while the launcher is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const apps = q ? APPS.filter((a) => a.label.toLowerCase().includes(q)) : APPS;
  const items = q ? ITEMS.filter((i) => i.label.toLowerCase().includes(q)) : ITEMS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 9500,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 4,
          width: "min(960px, 100%)",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #c9c9c9",
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#181818", flex: 1, margin: 0 }}>
            App Launcher
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: 0, fontSize: 20, cursor: "pointer", color: "#747474" }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #ecebea" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps and items..."
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #c9c9c9",
              borderRadius: 4,
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {/* Apps */}
        {apps.length > 0 && (
          <section style={{ padding: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "#444444", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>
              All Apps
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {apps.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 14,
                    border: "1px solid #ecebea",
                    borderRadius: 4,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "background .12s",
                  }}
                  className="sf-app-tile"
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      background: "#181818",
                      borderRadius: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>
                      {a.label.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                    </span>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#181818", marginBottom: 2 }}>
                      {a.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#747474" }}>{a.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Items */}
        {items.length > 0 && (
          <section style={{ padding: 20, borderTop: "1px solid #ecebea" }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "#444444", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>
              All Items
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 8,
              }}
            >
              {items.map((i) => (
                <Link
                  key={i.label}
                  href={i.href}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 4,
                    textDecoration: "none",
                    color: "#181818",
                    fontSize: 13,
                  }}
                  className="sf-item-tile"
                >
                  <ObjectIcon entity={i.entity} size="small" />
                  {i.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {apps.length === 0 && items.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#747474" }}>
            No apps or items match &quot;{query}&quot;.
          </div>
        )}

        <style jsx>{`
          :global(.sf-app-tile:hover) { background: #f3f2f2; }
          :global(.sf-item-tile:hover) { background: #f3f2f2; }
        `}</style>
      </div>
    </div>
  );
}
