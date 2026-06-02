import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface SettingsCard {
  href: string;
  title: string;
  description: string;
  count?: number;
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [users, profiles, roles, queues, permSets, integrations, templates] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.profile.count({ where: { isActive: true } }),
    prisma.role.count(),
    prisma.group.count({ where: { type: "QUEUE" } }),
    prisma.permissionSet.count(),
    prisma.integrationCredential.count(),
    prisma.emailTemplate.count({ where: { isActive: true } }),
  ]);

  const cards: { section: string; items: SettingsCard[] }[] = [
    {
      section: "Users & Access",
      items: [
        { href: "/settings/users", title: "Users", description: "Add, edit, and deactivate users", count: users },
        { href: "/settings/profiles", title: "Profiles", description: "Permission profiles users are assigned to", count: profiles },
        { href: "/settings/permission-sets", title: "Permission Sets", description: "Fine-grained capability bundles", count: permSets },
        { href: "/settings/roles", title: "Role Hierarchy", description: "Reporting relationships", count: roles },
        { href: "/settings/queues", title: "Queues", description: "Lead/case routing pools", count: queues },
      ],
    },
    {
      section: "Communications",
      items: [
        { href: "/email-templates", title: "Email Templates", description: "Reusable email content with merge fields", count: templates },
        { href: "/integrations", title: "Integrations", description: "Twilio, DocuSign, Five9, Pardot credentials", count: integrations },
      ],
    },
    {
      section: "Audit & Logs",
      items: [
        { href: "/settings/audit-log", title: "Audit Log", description: "Every write captured (entity, before, after, user)" },
        { href: "/settings/app-log", title: "Application Log", description: "Structured app/error log" },
        { href: "/settings/async-ops", title: "Async Operations", description: "Long-running job tracking" },
      ],
    },
  ];

  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #d8dde6", borderRadius: 4, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#080707", margin: 0 }}>Setup</h1>
        <p style={{ fontSize: 13, color: "#706e6b", marginTop: 4 }}>
          Logged in as <strong>{session.user?.name}</strong> ({session.user?.email})
        </p>
      </header>

      {cards.map((sec) => (
        <section key={sec.section} style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4,
            color: "#3e3e3c", margin: "0 0 8px 4px",
          }}>
            {sec.section}
          </h2>
          <div style={{
            display: "grid", gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}>
            {sec.items.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                style={{
                  background: "#fff", border: "1px solid #d8dde6", borderRadius: 4,
                  padding: 14, textDecoration: "none", color: "#080707",
                  display: "block",
                }}
                className="sf-setup-card"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{c.title}</span>
                  {c.count !== undefined && (
                    <span style={{
                      background: "#ecebea", color: "#3e3e3c",
                      padding: "2px 8px", borderRadius: 12,
                      fontSize: 11, fontWeight: 600,
                    }}>{c.count}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "#706e6b", margin: 0 }}>{c.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <style>{`.sf-setup-card:hover { background: #f3f2f2; }`}</style>
    </div>
  );
}
