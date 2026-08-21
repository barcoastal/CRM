import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AvailableClosers } from "@/components/dialer/available-closers";

export const dynamic = "force-dynamic";

/**
 * Standalone pop-out / Five9-embedded window (no CRM chrome) showing just the
 * open closers by tier. Two ways to auth:
 *  - a ?token= matching CLOSERS_WINDOW_TOKEN (for the Five9 Web Connector, where
 *    the CRM cookie is not sent cross-site), or
 *  - a normal CRM session (for the pop-out from the dialer).
 */
export default async function ClosersWindowPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tokenOk = !!token && !!process.env.CLOSERS_WINDOW_TOKEN && token === process.env.CLOSERS_WINDOW_TOKEN;

  if (!tokenOk) {
    const session = await auth();
    if (!session) redirect("/login");
  }

  return (
    <div style={{ padding: 8, background: "#f3f2f2", minHeight: "100vh", fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif" }}>
      <AvailableClosers apiToken={token ?? null} />
    </div>
  );
}
