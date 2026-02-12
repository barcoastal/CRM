import { auth } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name ?? "User";

  return <DashboardContent userName={userName} />;
}
