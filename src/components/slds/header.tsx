"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";

/**
 * Salesforce Lightning global header using actual SLDS classes
 * (.slds-global-header_container, .slds-global-header, etc.)
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

  return (
    <div className="slds-global-header_container">
      <header className="slds-global-header slds-grid slds-grid_align-spread">
        {/* Logo + App Launcher */}
        <div className="slds-global-header__item">
          <button
            className="slds-button slds-button_icon slds-global-actions__app-launcher"
            title="App Launcher"
            aria-label="App Launcher"
            style={{
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.20)",
              borderRadius: 4,
              padding: "6px 10px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "inline-grid",
                gridTemplateColumns: "repeat(3, 4px)",
                gap: 2,
              }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} style={{ width: 4, height: 4, borderRadius: 1, background: "#fff" }} />
              ))}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="slds-global-header__item slds-global-header__item_search">
          <div
            className="slds-form-element slds-lookup"
            style={{ width: "min(620px, 80%)" }}
          >
            <div className="slds-form-element__control">
              <div className="slds-input-has-icon slds-input-has-icon_left">
                <svg className="slds-input__icon slds-input__icon_left slds-icon-text-default" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#search" />
                </svg>
                <input
                  type="search"
                  className="slds-input"
                  placeholder={`Search ${appName} and more...`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="slds-global-header__item">
          <ul className="slds-global-actions">
            <li className="slds-global-actions__item">
              <button className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__setup" title="Setup">
                <svg className="slds-button__icon slds-button__icon_small" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#setup" />
                </svg>
              </button>
            </li>
            <li className="slds-global-actions__item">
              <button className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-small" title="Notifications">
                <svg className="slds-button__icon slds-button__icon_small" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#notification" />
                </svg>
              </button>
            </li>
            <li className="slds-global-actions__item">
              <button className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-small" title="Help">
                <svg className="slds-button__icon slds-button__icon_small" aria-hidden="true">
                  <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#question_mark" />
                </svg>
              </button>
            </li>
            <li className="slds-global-actions__item slds-global-actions__notifications" style={{ position: "relative" }}>
              <button
                className="slds-button slds-global-actions__avatar slds-global-actions__item-action"
                onClick={() => setProfileOpen((o) => !o)}
                title={userName ?? "Profile"}
              >
                <span className="slds-avatar slds-avatar_circle slds-avatar_medium" style={{ background: "#54698d", color: "#fff" }}>
                  <abbr title={userName} style={{ textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                    {userInitials}
                  </abbr>
                </span>
              </button>
              {profileOpen && (
                <div
                  className="slds-dropdown slds-dropdown_right slds-dropdown_actions"
                  style={{ position: "absolute", top: 38, right: 0, zIndex: 9100, minWidth: 220 }}
                >
                  {userName && (
                    <div className="slds-text-heading_small slds-p-around_small" style={{ borderBottom: "1px solid #d8dde6" }}>
                      {userName}
                    </div>
                  )}
                  <ul className="slds-dropdown__list" role="menu">
                    <li className="slds-dropdown__item" role="presentation">
                      <Link href="/settings" role="menuitem" onClick={() => setProfileOpen(false)}>
                        <span className="slds-truncate">Settings</span>
                      </Link>
                    </li>
                    <li className="slds-dropdown__item" role="presentation">
                      <a
                        href="#logout"
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault();
                          signOut({ callbackUrl: "/login" });
                        }}
                      >
                        <span className="slds-truncate">Log Out</span>
                      </a>
                    </li>
                  </ul>
                </div>
              )}
            </li>
          </ul>
        </div>
      </header>
    </div>
  );
}
