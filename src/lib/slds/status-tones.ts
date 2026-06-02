export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function leadStatusTone(status: string): StatusTone {
  switch (status) {
    case "ENROLLED":
    case "CONVERTED":
    case "QUALIFIED":
      return "success";
    case "CONTACTED":
    case "CALLBACK":
      return "info";
    case "UNQUALIFIED":
    case "LOST":
    case "DNC":
      return "danger";
    case "NEW":
    default:
      return "neutral";
  }
}

export function opportunityStageTone(stage: string): StatusTone {
  if (/CLOSED.*WON|WON|ENROLLED/i.test(stage)) return "success";
  if (/CLOSED.*LOST|LOST|CANCELLED/i.test(stage)) return "danger";
  if (/NEGOTIATION|PROPOSAL|CONTRACT/i.test(stage)) return "warning";
  return "info";
}

export function caseStatusTone(status: string): StatusTone {
  switch (status) {
    case "RESOLVED": case "CLOSED": return "success";
    case "ESCALATED": return "danger";
    case "WAITING_ON_CUSTOMER": return "warning";
    case "IN_PROGRESS": case "OPEN": return "info";
    case "NEW":
    default: return "neutral";
  }
}

export function programPlanStatusTone(status: string): StatusTone {
  switch (status) {
    case "ACTIVE": return "success";
    case "PAUSED": return "warning";
    case "COMPLETED": return "info";
    case "CANCELLED": return "danger";
    case "PROPOSED":
    default: return "neutral";
  }
}

export function draftStatusTone(status: string): StatusTone {
  switch (status) {
    case "SUCCESS": return "success";
    case "FAILED": return "danger";
    case "RETRYING": case "PROCESSING": return "warning";
    case "CANCELLED": return "neutral";
    case "SCHEDULED":
    default: return "info";
  }
}

export function settlementStatusTone(status: string): StatusTone {
  if (status === "PAID") return "success";
  if (status === "CANCELLED") return "danger";
  return "info";
}

export function genericTone(status: string): StatusTone {
  if (/active|success|won|paid|delivered|accepted|qualified|enrolled|converted|resolved/i.test(status)) return "success";
  if (/failed|lost|cancelled|rejected|dnc|escalated|bounced|complained/i.test(status)) return "danger";
  if (/pending|waiting|callback|retry|warning|negotiating/i.test(status)) return "warning";
  if (/progress|contacted|open|new|sent|received|info/i.test(status)) return "info";
  return "neutral";
}
