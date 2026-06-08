/**
 * Maps our entity names to SLDS standard-set icon paths + classes.
 */

export type EntityIcon = {
  iconSet: "standard" | "custom" | "action" | "utility";
  iconName: string;
  bgClass: string; // matches .sf-icon-bg-* in globals.css
};

export const ENTITY_ICONS: Record<string, EntityIcon> = {
  Account:      { iconSet: "standard", iconName: "account",          bgClass: "sf-icon-bg-account" },
  Contact:      { iconSet: "standard", iconName: "contact",          bgClass: "sf-icon-bg-contact" },
  Lead:         { iconSet: "standard", iconName: "lead",             bgClass: "sf-icon-bg-lead" },
  Opportunity:  { iconSet: "standard", iconName: "opportunity",      bgClass: "sf-icon-bg-opportunity" },
  Client:       { iconSet: "standard", iconName: "household",        bgClass: "sf-icon-bg-client" },
  Creditor:     { iconSet: "standard", iconName: "partners",         bgClass: "sf-icon-bg-creditor" },
  Case:         { iconSet: "standard", iconName: "case",             bgClass: "sf-icon-bg-case" },
  ProgramPlan:  { iconSet: "standard", iconName: "service_contract", bgClass: "sf-icon-bg-program_plan" },
  Draft:        { iconSet: "standard", iconName: "invoice",          bgClass: "sf-icon-bg-draft" },
  Offer:        { iconSet: "standard", iconName: "quotes",           bgClass: "sf-icon-bg-offer" },
  Settlement:   { iconSet: "standard", iconName: "agent_session",    bgClass: "sf-icon-bg-settlement" },
  Fee:          { iconSet: "standard", iconName: "currency",         bgClass: "sf-icon-bg-fee" },
  Task:         { iconSet: "standard", iconName: "task",             bgClass: "sf-icon-bg-task" },
  Event:        { iconSet: "standard", iconName: "event",            bgClass: "sf-icon-bg-event" },
  Email:        { iconSet: "standard", iconName: "email",            bgClass: "sf-icon-bg-email" },
  Sms:          { iconSet: "standard", iconName: "sms",              bgClass: "sf-icon-bg-sms" },
  Campaign:     { iconSet: "standard", iconName: "campaign",         bgClass: "sf-icon-bg-campaign" },
  User:         { iconSet: "standard", iconName: "user",             bgClass: "sf-icon-bg-user" },
  Dashboard:    { iconSet: "standard", iconName: "dashboard",        bgClass: "sf-icon-bg-program_plan" },
  Report:       { iconSet: "standard", iconName: "report",           bgClass: "sf-icon-bg-program_plan" },
  Calculator:   { iconSet: "standard", iconName: "feedback",         bgClass: "sf-icon-bg-task" },
  Settings:     { iconSet: "standard", iconName: "settings",         bgClass: "sf-icon-bg-user" },
  Dialer:       { iconSet: "standard", iconName: "call",             bgClass: "sf-icon-bg-sms" },
};

// Custom playful illustrated tiles live at /icons/custom/tiles/<Entity>.png and
// cover every ENTITY_ICONS key. We serve those instead of the old SLDS sprites.
export function iconUrl(entity: keyof typeof ENTITY_ICONS): string {
  if (ENTITY_ICONS[entity]) return `/icons/custom/tiles/${String(entity)}.png`;
  return `/icons/custom/tiles/Account.png`;
}

export function iconBg(entity: keyof typeof ENTITY_ICONS): string {
  return ENTITY_ICONS[entity]?.bgClass ?? "sf-icon-bg-account";
}
