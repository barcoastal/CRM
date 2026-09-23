"use client";

import type { CSSProperties } from "react";
import type { WinEvent } from "@/lib/scoreboard-shared";

export function Football({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 160 100" fill="none" aria-hidden="true">
    <path d="M6 50C35-10 125-10 154 50C125 110 35 110 6 50Z" fill="#9e5b2b" stroke="#edb96b" strokeWidth="3" />
    <path d="M9 50C51 72 109 72 151 50" stroke="#633515" strokeWidth="3" />
    <path d="M33 19C25 38 25 62 33 81M127 19C135 38 135 62 127 81" stroke="#fff5da" strokeWidth="10" />
    <path d="M53 41H107M60 33V49M73 33V49M87 33V49M100 33V49" stroke="#fff5da" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

export function Touchdown({ event, onDismiss }: { event: WinEvent; onDismiss: () => void }) {
  return <div className="sb-touchdown" role="status" aria-live="assertive" aria-atomic="true">
    <div className="sb-td-rays" />
    <div className="sb-td-field" />
    <div className="sb-confetti" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{
      "--x": `${(i * 37 % 100)}%`, "--delay": `${(i % 9) * .12}s`, "--spin": `${i * 59}deg`,
      "--drift": `${(i % 2 ? 1 : -1) * (60 + i % 7 * 30)}px`, "--fall": `${3 + i % 4 * .7}s`,
    } as CSSProperties} />)}</div>
    <button className="sb-td-dismiss" onClick={onDismiss} aria-label="Dismiss touchdown">Close ✕</button>
    <div className="sb-td-content">
      <div className="sb-td-kicker">{event.demo ? "TEST CELEBRATION · NO DEAL CHANGED" : "ANOTHER WIN FOR THE TEAM"}</div>
      <Football className="sb-td-ball" />
      <div className="sb-td-title">TOUCHDOWN<span>!</span></div>
      <div className="sb-td-rule"><span />CLOSED WON<span /></div>
      <div className="sb-td-name">{event.closerName}</div>
      {event.debt !== null && <div className="sb-td-debt">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(event.debt)}<small>IN CLIENT DEBT</small></div>}
      <div className="sb-td-cheer">BIG PLAY. BIG IMPACT.</div>
    </div>
    <div className="sb-td-timer" />
  </div>;
}

/** Generated locally after an explicit sound-toggle gesture; no audio download. */
export function playTouchdownSound(context: AudioContext) {
  if (context.state !== "running") return;
  const start = context.currentTime;
  [392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + i * .14);
    gain.gain.linearRampToValueAtTime(.10, start + i * .14 + .025);
    gain.gain.exponentialRampToValueAtTime(.001, start + i * .14 + (i === 4 ? 1.4 : .35));
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start + i * .14); oscillator.stop(start + i * .14 + 1.5);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
