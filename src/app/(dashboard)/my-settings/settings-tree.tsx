"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface TreeNode {
  label: string;
  href?: string;
  children?: TreeNode[];
}

const TREE: TreeNode[] = [
  {
    label: "My Personal Information",
    children: [
      { label: "Advanced User Details", href: "/my-settings/advanced" },
      { label: "Approver Settings", href: "/my-settings/approver" },
      { label: "Authentication Settings for External Systems", href: "/my-settings/external-auth" },
      { label: "Change My Password", href: "/my-settings/password" },
      { label: "Connections", href: "/my-settings/connections" },
      { label: "External Credentials", href: "/my-settings/external-credentials" },
      { label: "Grant Account Login Access", href: "/my-settings/grant-access" },
      { label: "Language & Time Zone", href: "/my-settings/language" },
      { label: "Login History", href: "/my-settings/login-history" },
      { label: "Personal Information", href: "/my-settings/personal-information" },
      { label: "Reset My Security Token", href: "/my-settings/reset-token" },
    ],
  },
  { label: "Display & Layout", href: "/my-settings/display-layout" },
  { label: "Connected Accounts", href: "/my-settings/connected-accounts" },
  {
    label: "Email",
    children: [
      { label: "Einstein Activity Capture", href: "/my-settings/einstein-capture" },
      { label: "My Email Settings", href: "/my-settings/email-settings" },
      { label: "My Send to Salesforce", href: "/my-settings/send-to-salesforce" },
      { label: "My Unresolved Items", href: "/my-settings/unresolved-items" },
    ],
  },
  { label: "Chatter", href: "/my-settings/chatter" },
  {
    label: "Calendar & Reminders",
    children: [
      { label: "Activity Reminders", href: "/my-settings/activity-reminders" },
      { label: "My Update Reminder", href: "/my-settings/update-reminder" },
      { label: "Desktop Add-Ons", href: "/my-settings/desktop-addons" },
    ],
  },
];

const DEFAULT_EXPANDED = new Set<string>([
  "My Personal Information",
  "Email",
  "Calendar & Reminders",
]);

const STORAGE_KEY = "sf:mySettings:expanded";

export function SettingsTree() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(DEFAULT_EXPANDED);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        setExpanded(new Set(arr));
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expanded)));
    } catch {}
  }, [expanded, hydrated]);

  const toggle = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const visibleTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TREE;
    return TREE.map((n) => {
      if (n.children) {
        const kids = n.children.filter((c) => c.label.toLowerCase().includes(q));
        if (kids.length || n.label.toLowerCase().includes(q)) {
          return { ...n, children: kids.length ? kids : n.children };
        }
        return null;
      }
      return n.label.toLowerCase().includes(q) ? n : null;
    }).filter(Boolean) as TreeNode[];
  }, [query]);

  const filteredExpanded = query
    ? new Set(visibleTree.filter((n) => n.children).map((n) => n.label))
    : expanded;

  return (
    <aside className="ms-tree-aside">
      <div className="ms-tree-search">
        <svg className="ms-tree-search-icon" aria-hidden="true">
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#search" />
        </svg>
        <input
          type="search"
          placeholder="Quick Find"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ms-tree-search-input"
        />
      </div>
      <ul className="ms-tree">
        {visibleTree.map((node) => {
          const isOpen = filteredExpanded.has(node.label);
          const hasChildren = !!node.children?.length;
          return (
            <li key={node.label}>
              {hasChildren ? (
                <button
                  type="button"
                  className="ms-tree-parent"
                  onClick={() => toggle(node.label)}
                  aria-expanded={isOpen}
                >
                  <svg
                    className={`ms-tree-chev ${isOpen ? "ms-tree-chev-open" : ""}`}
                    aria-hidden="true"
                  >
                    <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#chevronright" />
                  </svg>
                  <span>{node.label}</span>
                </button>
              ) : (
                <Link
                  href={node.href ?? "#"}
                  className={`ms-tree-leaf ms-tree-leaf-top ${pathname === node.href ? "ms-tree-leaf-active" : ""}`}
                >
                  {node.label}
                </Link>
              )}
              {hasChildren && isOpen && (
                <ul className="ms-tree-children">
                  {node.children!.map((child) => {
                    const active = pathname === child.href;
                    return (
                      <li key={child.label}>
                        <Link
                          href={child.href ?? "#"}
                          className={`ms-tree-leaf ${active ? "ms-tree-leaf-active" : ""}`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
