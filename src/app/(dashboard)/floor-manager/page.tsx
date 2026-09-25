import { redirect } from "next/navigation";
import { requireCallCenterPage } from "@/lib/call-center/page-access";
import LegacyFloor from "@/components/floor-manager/live-floor";
export default async function FloorManagerPage() {
  if (process.env.CRM_DIALER_MODE === "twilio") {
    await requireCallCenterPage("floor");
    redirect("/call-center/live-floor");
  }
  return <LegacyFloor />;
}
