"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ObjectIcon, UtilityIcon } from "./icon";

/**
 * Top SF Lightning navy header.
 * - App Launcher waffle (left)
 * - Current app name + dropdown
 * - Global Search (centered)
 * - Help / Setup / Notifications / Avatar (right)
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
    <header
      style={{
        height: 48,
        background: "linear-gradient(180deg, #1797c0 0%, #16325c 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        position: "sticky",
        top: 0,
        zIndex: 9000,
      }}
    >
      {/* App launcher */}
      <button
        aria-label="App Launcher"
        title="App Launcher"
        style={{
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 4,
          padding: "6px 8px",
          color: "#fff",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <span style={{ display: "inline-grid", gridTemplateColumns: "repeat(3,4px)", gap: 2 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} style={{ width: 4, height: 4, borderRadius: 1, background: "#fff" }} />
          ))}
        </span>
      </button>

      {/* Current app */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{appName}</span>
        <UtilityIcon name="chevrondown" size={12} color="invert(1)" />
      </div>

      {/* Search */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.95)",
            borderRadius: 4,
            padding: "0 8px",
            width: "min(620px, 80%)",
            height: 32,
          }}
        >
          <UtilityIcon name="search" size={16} />
          <input
            placeholder="Search..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              padding: "0 8px",
              color: "#181818",
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Right utilities */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button title="Setup" aria-label="Setup" className="sf-header-icon-btn">
          <UtilityIcon name="setup" size={20} color="invert(1)" />
        </button>
        <button title="Notifications" aria-label="Notifications" className="sf-header-icon-btn">
          <UtilityIcon name="notification" size={20} color="invert(1)" />
        </button>
        <button title="Help" aria-label="Help" className="sf-header-icon-btn">
          <UtilityIcon name="question_mark" size={20} color="invert(1)" />
        </button>
        <div style={{ position: "relative" }}>
          <button
            aria-label="User menu"
            title={userName ?? "Profile"}
            onClick={() => setProfileOpen((o) => !o)}
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              padding: 0,
              borderRadius: "50%",
            }}
          >
            <span
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#16325c", color: "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, border: "2px solid rgba(255,255,255,0.4)",
              }}
            >
              {userInitials}
            </span>
          </button>
          {profileOpen && (
            <div
              style={{
                position: "absolute", top: 38, right: 0,
                background: "#fff", color: "#181818",
                minWidth: 200, borderRadius: 4, padding: 8,
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                zIndex: 9001,
              }}
            >
              {userName && (
                <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e5e5", fontWeight: 600 }}>
                  {userName}
                </div>
              )}
              <Link href="/settings" className="sf-menu-item" onClick={() => setProfileOpen(false)}>
                Settings
              </Link>
              <button
                className="sf-menu-item"
                onClick={() => signOut({ callbackUrl: "/login" })}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, cursor: "pointer" }}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        :global(.sf-header-icon-btn) {
          background: transparent;
          border: 0;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        :global(.sf-header-icon-btn:hover) {
          background: rgba(255,255,255,0.1);
        }
        :global(.sf-menu-item) {
          display: block;
          padding: 8px 12px;
          color: #181818;
          font-size: 13px;
          text-decoration: none;
          border-radius: 3px;
        }
        :global(.sf-menu-item:hover) {
          background: #f3f2f2;
        }
      `}</style>
    </header>
  );
}
