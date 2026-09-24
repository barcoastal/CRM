"use client";

import type { PassEvent } from "@/lib/scoreboard-shared";
import { Football } from "./touchdown";

export function PassThrown({ event, onDismiss }: { event: PassEvent; onDismiss: () => void }) {
  const debt = event.debt !== null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(event.debt) : event.debtLabel;
  return <div className="sb-pass" role="status" aria-live="polite" aria-atomic="true">
    <div className="sb-pass-field" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <button className="sb-td-dismiss" onClick={onDismiss} aria-label="Dismiss pass">Close ✕</button>
    <div className="sb-pass-content">
      <div className="sb-pass-kicker">{event.demo ? "TEST PLAY · NO TRANSFER MADE" : "A NEW OPPORTUNITY IS IN PLAY"}</div>
      <div className="sb-pass-title">PASS THROWN<span>!</span></div>
      <div className="sb-pass-play" aria-hidden="true">
        <span className="sb-pass-marker sb-pass-qb">QB</span>
        <svg className="sb-pass-route" viewBox="0 0 800 180" preserveAspectRatio="none"><path d="M40 155 Q400 -100 760 155" /></svg>
        <div className="sb-pass-flight"><Football /></div>
        <span className="sb-pass-marker sb-pass-wr">WR</span>
        <span className="sb-pass-catch" />
      </div>
      <div className="sb-pass-players">
        <div><small>PASS FROM</small><strong>{event.fronterName || "The floor team"}</strong></div>
        <span className="sb-pass-arrow" aria-hidden="true">→</span>
        <div><small>TO CLOSER</small><strong>{event.closerName}</strong></div>
      </div>
      {debt && <div className="sb-pass-debt">{debt}<small>CLIENT DEBT · TRANSFER ASSIGNED</small></div>}
      <p>YOUR NEXT TOUCHDOWN STARTS HERE.</p>
    </div>
    <div className="sb-pass-timer" />
  </div>;
}
