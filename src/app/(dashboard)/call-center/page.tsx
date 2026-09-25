import { redirect } from "next/navigation";
import { requireCallCenterPage } from "@/lib/call-center/page-access";
export default async function CallCenterPage() {
  const access = await requireCallCenterPage();
  redirect(access.home);
}
