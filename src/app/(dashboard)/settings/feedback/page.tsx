import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeedbackAdminList } from "@/components/settings/feedback-admin-list";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function FeedbackAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/dashboard");

  const items = await prisma.feedback.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          padding: "12px 16px",
          marginBottom: 8,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#181818" }}>
          User Feedback ({items.length})
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#747474" }}>
          Bug reports, ideas and Salesforce-difference reports from the team. Status changes
          notify the person who reported.
        </p>
      </div>
      <FeedbackAdminList
        items={items.map((i) => ({
          id: i.id,
          type: i.type,
          message: i.message,
          screenshot: i.screenshot,
          pageUrl: i.pageUrl,
          userAgent: i.userAgent,
          status: i.status,
          adminNotes: i.adminNotes,
          createdAt: i.createdAt.toISOString(),
          userName: i.user.name,
          userEmail: i.user.email,
        }))}
      />
    </div>
  );
}
