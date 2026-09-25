import { requireCallCenterPage } from "@/lib/call-center/page-access";
import { CallCenterOperationsScreen } from "@/components/call-center/workspace";
export default async function Page() {
  await requireCallCenterPage("operations");
  return <CallCenterOperationsScreen />;
}
