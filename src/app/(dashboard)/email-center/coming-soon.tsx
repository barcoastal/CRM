import Link from "next/link";

export function ComingSoon({
  title,
  phase,
  existingLabel,
  existingHref,
}: {
  title: string;
  phase: string;
  existingLabel?: string;
  existingHref?: string;
}) {
  return (
    <div className="ec-soon-wrap" style={{ flex: 1 }}>
      <div className="ec-soon-card">
        <div className="ec-soon-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
          </svg>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span className="ec-pill ec-pill-green">Coming in {phase}</span>
        </div>
        <h1 className="ec-soon-title">{title}</h1>
        <p className="ec-soon-text">
          This part of the Email Center is on the way. It will live right here when it ships.
        </p>
        {existingHref ? (
          <Link className="ec-soon-link" href={existingHref}>
            Until then, use {existingLabel} &rarr;
          </Link>
        ) : null}
      </div>
    </div>
  );
}
