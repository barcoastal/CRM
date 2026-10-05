/** Keep both CRM navigation surfaces aligned with the current user's grants. */
import { deniesContactAccess } from "@/lib/closer-contact-access";
const requirements: Record<string, string[]> = {
  "/dashboard": ["Dashboards.View"],
  "/calculator": ["ProgramPlan.View"],
  "/tasks": ["Task.View"],
  "/leads": ["Lead.View"],
  "/accounts": ["Account.View"],
  "/contacts": ["Contact.View"],
  "/opportunities": ["Opportunity.View"],
  "/integrations/processor-log": ["Integration.Manage"],
  "/cases": ["Case.View"],
  "/settings/app-log": ["AppLog.View"],
  "/reports": ["Reports.View"],
  "/negotiations": ["Debt.View"],
  "/floor-manager": ["CallCenter.Supervise"],
  "/war-room": ["CallCenter.Supervise"],
  "/lenders": ["Debt.View"],
  "/dashboards": ["Dashboards.View"],
  "/forecasting": ["Reports.View"],
  "/scoreboard": ["Dashboards.View"],
  "/clients": ["Account.View"],
  "/creditors": ["Debt.View"],
  "/approvals": ["Case.Approve"],
  "/events": ["Event.View"],
  "/chatter": ["Lead.View"],
  "/chatter/groups": ["Lead.View"],
  "/program-plans": ["ProgramPlan.View"],
  "/drafts": ["Draft.View"],
  "/offers": ["Offer.View"],
  "/settlements": ["Settlement.View"],
  "/fees": ["Fee.View"],
  "/emails": ["Email.Send", "Email.MassSend"],
  "/emails/mass": ["Email.MassSend"],
  "/email-center": ["Email.Send"],
  "/sms": ["SMS.Send"],
  "/email-templates": ["Email.Send"],
  "/files": ["ProgramPlan.View"],
  "/integrations": ["Integration.Manage"],
  "/dialer": ["Call.Log"],
  "/ai-dialer": ["Call.Log"],
  "/call-center": ["Call.Log"],
  "/marketing": ["Lead.View"],
  "/marketing/engagement": ["Lead.View"],
  "/marketing/sources": ["Lead.View"],
  "/marketing/postbacks": ["Integration.Manage"],
  "/sign-docs": ["ProgramPlan.View"],
  "/campaigns": ["Lead.View"],
  "/automation/flows": ["Permission.Manage"],
};

export function canUsePermission(permissions: readonly string[], required: string): boolean {
  const grants = new Set(permissions);
  if (deniesContactAccess(grants, required)) return false;
  if (grants.has("Modify.AllData") || grants.has(required)) return true;
  const [entity, action] = required.split(".");
  return action === "View" && (grants.has(`${entity}.ViewAll`) || grants.has(`${entity}.ModifyAll`));
}

export function canViewNavigation(href: string, permissions: readonly string[]): boolean {
  const required = requirements[href];
  return !required || required.some(key => canUsePermission(permissions, key));
}
