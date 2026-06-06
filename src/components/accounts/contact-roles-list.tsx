/**
 * Contact Roles related-list for the Account page. Mirrors SF Contact Roles
 * UI (Primary, Role). Uses AccountContactRelation.role today.
 */
import Link from "next/link";

type Row = {
  id: string;
  role: string | null;
  isPrimary: boolean;
  contact: {
    id: string;
    fullName: string;
    title: string | null;
    email: string | null;
    phone: string | null;
  };
};

export function ContactRolesList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <article
        style={{
          background: "#fff",
          border: "1px solid #dddbda",
          borderRadius: 4,
          marginBottom: 12,
          overflow: "hidden",
          boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
        }}
      >
        <header
          style={{
            background: "#fafaf9",
            borderBottom: "1px solid #dddbda",
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
              background: "#a094ed",
              color: "#fff",
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            C
          </span>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#080707", margin: 0 }}>
            Contact Roles (0)
          </h3>
        </header>
        <div style={{ padding: "12px 16px", fontSize: 12, color: "#706e6b" }}>No contact roles yet.</div>
      </article>
    );
  }

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
        marginBottom: 12,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
      }}
    >
      <header
        style={{
          background: "#fafaf9",
          borderBottom: "1px solid #dddbda",
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
            background: "#a094ed",
            color: "#fff",
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
            <path d="M26 24c5 0 9-4 9-9s-4-9-9-9-9 4-9 9 4 9 9 9zm0 4c-6 0-18 3-18 9v5h36v-5c0-6-12-9-18-9z" />
          </svg>
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#080707", margin: 0 }}>
          Contact Roles ({rows.length})
        </h3>
      </header>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
            <th style={th}>Name</th>
            <th style={th}>Title</th>
            <th style={th}>Role</th>
            <th style={th}>Phone</th>
            <th style={th}>Email</th>
            <th style={th}>Primary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td style={td}>
                <Link href={`/contacts/${r.contact.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                  {r.contact.fullName}
                </Link>
              </td>
              <td style={td}>{r.contact.title ?? ""}</td>
              <td style={td}>{r.role ?? ""}</td>
              <td style={td}>{r.contact.phone ?? ""}</td>
              <td style={td}>
                {r.contact.email && (
                  <Link href={`mailto:${r.contact.email}`} style={{ color: "#1589ee" }}>
                    {r.contact.email}
                  </Link>
                )}
              </td>
              <td style={td}>
                {r.isPrimary && (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      background: "#ddf5d6",
                      color: "#0b683b",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Primary
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 11,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#080707",
  fontSize: 13,
};
