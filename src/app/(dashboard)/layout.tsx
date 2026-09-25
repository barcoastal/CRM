import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SldsShell } from "@/components/slds/shell";
import { PhoneDock } from "@/components/dialer/phone-dock";
import { hasPermission } from "@/lib/permissions";
import { CallCenterGate } from "@/components/call-center/gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.mustResetPassword) redirect("/reset-password");

  // Only closers get the Five9 popup dialer (toggled per user in Settings → Users).
  const me = session.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { isCloser: true } })
    : null;

  return (
    <CallCenterGate
      canCall={hasPermission(session.user?.permissions ?? [], "Call.Log")}
      enabled={process.env.CRM_DIALER_MODE === "twilio"}
    >
      <SldsShell userName={session.user?.name ?? undefined}>
        {children}
        {process.env.CRM_DIALER_MODE !== "twilio" && me?.isCloser && <PhoneDock />}
      </SldsShell>
    </CallCenterGate>
  );
}
