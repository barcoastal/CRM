import { ensureCaseApprovalProcess } from "./case-approvals";
import { runCadenceTick } from "@/lib/cadences";

let armed = false;
export function scheduleAutomation() {
  if (armed || process.env.NEXT_PHASE === "phase-production-build") return;
  armed = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await ensureCaseApprovalProcess().catch(error => console.error("[case-approval-setup]", error.message));
      if (process.env.ENABLE_OPPORTUNITY_CADENCES === "true") await runCadenceTick(new Date(), true);
    } catch (error) {
      console.error("[automation]", error instanceof Error ? error.message : "Automation failed");
    } finally { running = false; }
  };
  setTimeout(() => void tick(), 60_000).unref();
  setInterval(() => void tick(), 60_000).unref();
}
