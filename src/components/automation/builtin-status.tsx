import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CASE_APPROVAL_PROCESS_ID } from "@/lib/automation/case-policy";

export async function BuiltinAutomationStatus() {
  const [approvalProcess, approvers, owner, cadences, manager, locations] = await Promise.all([
    prisma.approvalProcess.findUnique({ where: { id: CASE_APPROVAL_PROCESS_ID } }),
    prisma.groupMember.count({ where: { group: { developerName: "CS_Case_Approvers" }, user: { isActive: true } } }),
    prisma.user.findFirst({ where: { email: { equals: process.env.WEB_LEAD_OWNER_EMAIL || "ssweet@coastaldebt.com", mode: "insensitive" }, isActive: true }, select: { name: true } }),
    prisma.callCadence.findMany({ where: { name: { in: ["Welcome Call", "Contract Signed"] } }, include: { _count: { select: { steps: true } } } }),
    prisma.user.findFirst({ where: { email: { equals: process.env.CONTRACT_CADENCE_OWNER_EMAIL || "ferron@coastaldebt.com", mode: "insensitive" }, isActive: true }, select: { id: true } }),
    prisma.user.count({ where: { isActive: true, userCountry: { not: null } } }),
  ]);
  return <section className="rounded border bg-white p-4 space-y-2" aria-label="Built-in automation status">
    <h2 className="font-semibold">Built-in automations</h2>
    <p>Case approvals: {approvalProcess?.isActive && approvers ? `Ready · ${approvers} active queue members` : "Setup needed: active approval process and CS Case Approvers queue members"}. <Link href="/approvals/processes" className="text-blue-700">Approval processes</Link></p>
    <p>Web-lead assignment: {process.env.DISABLE_WEB_LEAD_ROUTING === "true" ? "Disabled" : owner ? `Ready · ${owner.name}` : "Setup needed: mapped active lead owner"}.</p>
    {(["Welcome Call", "Contract Signed"] as const).map(name => {
      const cadence = cadences.find(item => item.name === name);
      return <p key={name}>{name}: {cadence?.isActive && cadence._count.steps && (name !== "Contract Signed" || manager) ? "Ready for automatic enrollment" : "Setup needed: active cadence, verified steps and mapped owner"}.</p>;
    })}
    <p>Agent locations: {locations} active users configured. <Link href="/settings/users" className="text-blue-700">Manage users</Link></p>
  </section>;
}
