import { requireCallCenterPage } from "@/lib/call-center/page-access";
import { CloserScreen } from "@/components/call-center/workspace";
export default async function Page() {
  await requireCallCenterPage("closer");
  return <CloserScreen />;
}
