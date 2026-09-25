import { requireCallCenterPage } from "@/lib/call-center/page-access";
import { OpenerScreen } from "@/components/call-center/workspace";
export default async function Page() {
  await requireCallCenterPage("opener");
  return <OpenerScreen />;
}
