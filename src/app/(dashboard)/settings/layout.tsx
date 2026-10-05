import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const setupPermissions = ["User.View", "Permission.Manage", "Integration.Manage", "AppLog.View", "Audit.View"];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!(["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.user.role) || setupPermissions.some(key => hasPermission(session.user.permissions, key)))) {
    return <p style={{ padding: 24 }}>Access denied. You do not have permission to view setup.</p>;
  }
  return children;
}
