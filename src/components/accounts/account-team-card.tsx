/**
 * Lightweight Account Team card. SF uses an AccountTeamMember object with
 * roles like Owner, Closer, Customer Service Rep. Our Prisma schema does not
 * yet model AccountTeamMember, so this card surfaces the owner + closer/
 * fronter pulled from opportunities so closers see the full team at a glance.
 */
import Link from "next/link";

type Member = {
  role: string;
  name: string | null;
  email?: string | null;
};

export function AccountTeamCard({
  ownerName,
  ownerEmail,
  members,
}: {
  ownerName: string | null;
  ownerEmail?: string | null;
  members: Member[];
}) {
  const all: Member[] = [
    { role: "Owner", name: ownerName, email: ownerEmail },
    ...members,
  ].filter((m) => m.name);

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
      }}
    >
      <header
        style={{
          background: "#fafaf9",
          borderBottom: "1px solid #c9c9c9",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            background: "#0176d3",
            color: "#fff",
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
            <path d="M26 24c5 0 9-4 9-9s-4-9-9-9-9 4-9 9 4 9 9 9zm0 4c-6 0-18 3-18 9v5h36v-5c0-6-12-9-18-9z" />
          </svg>
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
          Account Team
        </h3>
      </header>
      <div style={{ padding: "8px 16px" }}>
        {all.length === 0 ? (
          <div style={{ fontSize: 12, color: "#747474" }}>No team members yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {all.map((m, i) => (
              <li
                key={`${m.role}-${i}`}
                style={{
                  padding: "8px 0",
                  borderTop: i === 0 ? "none" : "1px solid #f3f2f2",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 400, color: "#444444" }}>
                  {m.role}
                </span>
                <span style={{ fontSize: 13, color: "#181818", fontWeight: 600 }}>{m.name}</span>
                {m.email && (
                  <Link href={`mailto:${m.email}`} style={{ fontSize: 12, color: "#0176d3" }}>
                    {m.email}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
