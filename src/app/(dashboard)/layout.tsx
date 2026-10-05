import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SldsShell } from "@/components/slds/shell";
import { ChatDock } from "@/components/google-chat/chat-dock";
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
  if (session.user?.mustResetPassword && !session.impersonation) redirect("/reset-password");
  if (session.impersonation?.unavailable) return <p style={{ padding: 24 }}>This user preview is no longer available. Use “Return to admin” above.</p>;
  if (session.impersonation && session.user.mustResetPassword) return <p style={{ padding: 24 }}>This user must set their password before accessing the CRM. Use “Return to admin” above.</p>;

  // Only closers get the Five9 popup dialer (toggled per user in Settings → Users).
  const me = session.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, isActive: true, isCloser: true } })
    : null;

  return (
    <CallCenterGate
      canCall={hasPermission(session.user?.permissions ?? [], "Call.Log")}
      enabled={process.env.CRM_DIALER_MODE === "twilio"}
    >
      <SldsShell userName={session.user?.name ?? undefined} preview={!!session.impersonation} permissions={session.user.permissions}>
        {children}
        {!session.impersonation && me?.isActive && me.email.toLowerCase().endsWith(`@${(process.env.GOOGLE_CHAT_DOMAIN || "coastaldebt.com").trim().toLowerCase()}`) && <ChatDock key={me.id} account={{ id: me.id, name: me.name, email: me.email }} />}
        {process.env.CRM_DIALER_MODE !== "twilio" && me?.isCloser && <PhoneDock />}
      </SldsShell>
    </CallCenterGate>
  );
}
