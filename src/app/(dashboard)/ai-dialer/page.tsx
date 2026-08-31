import { auth } from "@/lib/auth";
import { getAiDialerOverview } from "@/lib/ai-dialer/overview";
import { AiDialerDashboard } from "@/components/ai-dialer/ai-dialer-dashboard";

export default async function AiDialerPage() {
  await auth();
  return <AiDialerDashboard initialOverview={await getAiDialerOverview()} />;
}
