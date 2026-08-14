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
    <div style={{ padding: 40, maxWidth: 560 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 13, color: "#444", marginBottom: 12 }}>
          Coming in {phase} of the Email Center build.
        </p>
        {existingHref ? (
          <p style={{ fontSize: 13 }}>
            Until then, use <Link href={existingHref} style={{ color: "#0176d3" }}>{existingLabel}</Link>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
