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
        border: "1px solid #d8dde6",
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, marginBottom: 8 }}>
        Account Team
      </h3>
      {all.length === 0 ? (
        <div style={{ fontSize: 12, color: "#706e6b" }}>No team members yet.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {all.map((m, i) => (
            <li
              key={`${m.role}-${i}`}
              style={{
                padding: "6px 0",
                borderTop: i === 0 ? "none" : "1px solid #f3f3f3",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "#706e6b", textTransform: "uppercase" }}>
                {m.role}
              </span>
              <span style={{ fontSize: 13, color: "#080707" }}>{m.name}</span>
              {m.email && (
                <Link href={`mailto:${m.email}`} style={{ fontSize: 11, color: "#1589ee" }}>
                  {m.email}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
