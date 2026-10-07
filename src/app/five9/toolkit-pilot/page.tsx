import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { OpenerFrameLogin } from "../opener/sign-in";
import { Five9ToolkitPilot } from "./pilot-client";

export const dynamic = "force-dynamic";

/** Opt-in Bar1 pilot: Five9 Toolkit beside the CRM lead workspace. */
export default async function Five9ToolkitPilotPage() {
  const session = await auth();
  if (!session?.user?.id) return <OpenerFrameLogin />;

  const allowedEmails = (process.env.FIVE9_FRAME_PILOT_EMAILS ?? "")
    .split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  if (process.env.NODE_ENV === "production" &&
      (!session.user.email || !allowedEmails.includes(session.user.email.toLowerCase()))) {
    return <PilotMessage>This Five9 pilot is not enabled for your account.</PilotMessage>;
  }
  if (session.user.mustResetPassword) {
    return <PilotMessage>Set your CRM password, then reopen this page.</PilotMessage>;
  }
  if (!hasPermission(session.user.permissions ?? [], "Lead.View") ||
      !hasPermission(session.user.permissions ?? [], "Lead.Edit")) {
    return <PilotMessage>Your CRM account needs Lead View and Lead Edit access.</PilotMessage>;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { five9Username: true },
  });
  return <Five9ToolkitPilot
    userId={session.user.id}
    expectedFive9Login={user?.five9Username ?? session.user.email ?? ""}
  />;
}

function PilotMessage({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}><strong>Coastal CRM</strong><p>{children}</p></main>;
}
