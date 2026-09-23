import type { ReactNode } from "react";
import { FloorManagerNav } from "@/components/floor-manager/hub-nav";
import "./hub.css";

export default function FloorManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fm-hub">
      <header className="fm-hub-header">
        <div className="fm-hub-heading">
          <span className="fm-hub-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 20v-6h5v6M10 20V9h5v11M17 20V4h5v16M2 20h21" />
            </svg>
          </span>
          <div>
            <h1>Floor Manager Hub</h1>
            <p>Manage the floor, meetings, and the right closer for every client.</p>
          </div>
        </div>
        <FloorManagerNav />
      </header>
      <div className="fm-hub-content">{children}</div>
    </div>
  );
}
