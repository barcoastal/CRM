"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePhone } from "./provider";
import "./handoff.css";
type Alert = { key: string; title: string; body: string; href: string };
export function CallAlerts() {
  const { data } = usePhone();
  const seen = useRef(new Set<string>());
  const context = useRef<AudioContext | null>(null);
  const [soundReady, setSoundReady] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  useEffect(() => {
    const unlock = () => {
      context.current ??= new AudioContext();
      void context.current
        .resume()
        .then(() => setSoundReady(context.current?.state === "running"))
        .catch(() => setSoundReady(false));
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void context.current?.close();
      context.current = null;
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const alerts: Alert[] = [];
    for (const call of data.calls) {
      if (call.status !== "IN_PROGRESS" || !call.transferRequestKey) continue;
      const key = `${call.id}:${call.transferRequestKey}:${call.salesStage}`;
      const name = call.call?.lead?.contactName || "Client";
      if (data.sales?.access.floor && call.salesStage === "PENDING_APPROVAL")
        alerts.push({
          key,
          title: "Transfer approval requested",
          body: `${name} is speaking with an opener. Review the lender details and choose a closer.`,
          href: "/call-center/live-floor#transfer-approvals",
        });
      else if (
        call.transferTargetId === data.userId &&
        call.salesStage === "PENDING_CLOSER"
      )
        alerts.push({
          key,
          title: "Approved handoff waiting",
          body: `${name} is ready for a closer. Mark open when you can receive the introduction.`,
          href: "/call-center/closer#handoff-requests",
        });
      else if (
        call.openerId === data.userId &&
        call.salesStage === "CLOSER_READY"
      )
        alerts.push({
          key,
          title: "Your closer is ready",
          body: `Connect the closer to your call with ${name}.`,
          href: "/call-center/opener",
        });
      else if (
        call.openerId === data.userId &&
        call.salesStage === "TRANSFER_REJECTED"
      )
        alerts.push({
          key,
          title: "Transfer request declined",
          body: call.transferReason || "Review the Floor Manager's response.",
          href: "/call-center/opener",
        });
    }
    const next = alerts.find((item) => !seen.current.has(item.key));
    const timer = window.setTimeout(() => {
      setAlert(
        (current) =>
          next ||
          (current && alerts.some((item) => item.key === current.key)
            ? current
            : null),
      );
      if (next) {
        seen.current.add(next.key);
        const audio = context.current;
        if (audio?.state === "running") {
          for (const offset of [0, 0.16]) {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = offset ? 880 : 660;
            gain.gain.setValueAtTime(0, audio.currentTime + offset);
            gain.gain.linearRampToValueAtTime(
              0.07,
              audio.currentTime + offset + 0.01,
            );
            gain.gain.exponentialRampToValueAtTime(
              0.001,
              audio.currentTime + offset + 0.13,
            );
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start(audio.currentTime + offset);
            oscillator.stop(audio.currentTime + offset + 0.14);
          }
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data]);
  if (!alert) return null;
  return (
    <aside className="cc-call-alert" role="alert">
      <button onClick={() => setAlert(null)} aria-label="Dismiss call alert">
        Dismiss
      </button>
      <strong>{alert.title}</strong>
      <p>{alert.body}</p>
      <Link href={alert.href}>Open handoff</Link>
      {!soundReady && (
        <button
          className="cc-alert-audio"
          onClick={() => {
            context.current ??= new AudioContext();
            void context.current
              .resume()
              .then(() => setSoundReady(context.current?.state === "running"))
              .catch(() => setSoundReady(false));
          }}
        >
          Enable alert sound
        </button>
      )}
    </aside>
  );
}
