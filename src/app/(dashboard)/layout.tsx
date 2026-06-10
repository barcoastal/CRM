import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SldsShell } from "@/components/slds/shell";
import { PhoneDock } from "@/components/dialer/phone-dock";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.mustResetPassword) redirect("/reset-password");

  return (
    <SldsShell userName={session.user?.name ?? undefined}>
      {children}
      {/* Persistent softphone dock — stays mounted across navigation so the
          closer can work the full CRM while staying on the call. */}
      <PhoneDock />
    </SldsShell>
  );
}
