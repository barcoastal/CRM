import { auth } from "@/lib/auth";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name ?? "User";

  return <ManagerDashboard userName={userName} />;
}
