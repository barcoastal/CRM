import { requireCallCenterPage } from "@/lib/call-center/page-access";
import { LiveFloorScreen } from "@/components/call-center/workspace";
export default async function Page() {
  await requireCallCenterPage("floor");
  return <LiveFloorScreen />;
}
