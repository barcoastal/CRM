import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AvailableClosers } from "@/components/dialer/available-closers";

export const dynamic = "force-dynamic";

/**
 * Standalone pop-out window (no CRM chrome) showing just the open closers by
 * tier. Meant to be opened via window.open and docked next to the Five9 agent
 * window. Shares the CRM session cookie, so the availability API is authorized.
 */
export default async function ClosersWindowPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <div style={{ padding: 8, background: "#f3f2f2", minHeight: "100vh", fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif" }}>
      <AvailableClosers />
    </div>
  );
}
