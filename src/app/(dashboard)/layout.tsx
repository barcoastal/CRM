import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SldsShell } from "@/components/slds/shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.mustResetPassword) redirect("/reset-password");

  return <SldsShell userName={session.user?.name ?? undefined}>{children}</SldsShell>;
}
