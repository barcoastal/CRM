import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  // Only closers get the Five9 popup dialer (toggled per user in Settings → Users).
  const me = session.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { isCloser: true } })
    : null;

  return (
    <SldsShell userName={session.user?.name ?? undefined}>
      {children}
      {/* Persistent softphone dock — stays mounted across navigation so the
          closer can work the full CRM while staying on the call. Closers only. */}
      {me?.isCloser && <PhoneDock />}
    </SldsShell>
  );
}
