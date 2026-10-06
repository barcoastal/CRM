import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Five9Client } from "@/app/(dashboard)/dialer/five9-client";
import { OpenerFrameLogin } from "./sign-in";

export const dynamic = "force-dynamic";

/** CRM lead workspace loaded in the Five9 Agent Desktop Plus embedded tab. */
export default async function Five9OpenerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return <OpenerFrameLogin />;
  if (process.env.NODE_ENV === "production") {
    const allowedEmails = (process.env.FIVE9_FRAME_PILOT_EMAILS ?? "")
      .split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!session.user.email || !allowedEmails.includes(session.user.email.toLowerCase())) {
      return <FrameMessage message="This Five9 CRM pilot is not enabled for your account." />;
    }
  }
  if (session.user.mustResetPassword) {
    return <FrameMessage message="Set your CRM password in a separate tab, then reload this frame." href="/reset-password" link="Set password ↗" />;
  }
  if (!hasPermission(session.user.permissions ?? [], "Lead.View")) {
    return <FrameMessage message="Your CRM account needs Lead View access for this workspace." />;
  }
  if (!hasPermission(session.user.permissions ?? [], "Lead.Edit")) {
    return <FrameMessage message="Your CRM account needs Lead Edit access to work leads in this frame." />;
  }
  const params = await searchParams;
  // Manually dialed calls may have no Five9 contact record. In that case the
  // connector's Customer.number1 can be empty while Call.number is populated.
  const phone = [params.phone, params.call_number, params.number1, params.ani]
    .flatMap(value => Array.isArray(value) ? value : [value])
    .map(value => (value ?? "").replace(/\D/g, ""))
    .find(value => value.length >= 7 && value.length <= 15) ?? null;
  return <Five9Client five9Domain={null} defaultStation={null} frameOnly initialPhone={phone} userId={session.user.id} />;
}

function FrameMessage({ message, href, link }: { message: string; href?: string; link?: string }) {
  return (
    <main style={{ padding: 20, fontFamily: "Arial, sans-serif", color: "#181818" }}>
      <strong>Coastal CRM</strong>
      <p>{message}</p>
      {href && <a href={href} target="_blank" rel="noopener noreferrer">{link}</a>}
    </main>
  );
}
