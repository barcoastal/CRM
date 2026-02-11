/**
 * Call Follow-Up Agent (Mock)
 *
 * Analyzes a completed call and generates follow-up recommendations
 * including suggested action, follow-up date, draft message, and
 * AI-enhanced call notes.
 */

interface CallFollowUpInput {
  disposition: string | null;
  notes: string | null;
  lead: {
    contactName: string;
    businessName: string;
  };
}

interface CallFollowUpResult {
  suggestedAction: string;
  followUpDate: Date | null;
  draftMessage: string;
  autoNotes: string;
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // default to 9 AM
  return d;
}

export function analyzeCallFollowUp(input: CallFollowUpInput): CallFollowUpResult {
  const { disposition, notes, lead } = input;
  const { contactName, businessName } = lead;

  const cleanNotes = notes?.trim() || "";

  switch (disposition) {
    case "INTERESTED":
      return {
        suggestedAction: "Schedule callback for tomorrow to discuss enrollment details",
        followUpDate: addDays(1),
        draftMessage:
          `Thank you for speaking with us about reducing your business debt. ` +
          `As discussed, we can help ${businessName} save significantly. ` +
          `Let's schedule a follow-up to review your options.`,
        autoNotes: buildAutoNotes("Prospect expressed interest in debt settlement services.", cleanNotes),
      };

    case "CALLBACK":
      return {
        suggestedAction: "Schedule callback as requested by the prospect",
        followUpDate: addDays(3),
        draftMessage:
          `Hi ${contactName}, following up on our conversation about debt settlement ` +
          `for ${businessName}. Ready to continue when you are.`,
        autoNotes: buildAutoNotes("Prospect requested a callback to continue the conversation.", cleanNotes),
      };

    case "NOT_INTERESTED":
      return {
        suggestedAction: "Mark for re-engagement in 30 days when market conditions change",
        followUpDate: addDays(30),
        draftMessage:
          `Hi ${contactName}, just checking in. Market conditions have changed and ` +
          `we may have new options for ${businessName}.`,
        autoNotes: buildAutoNotes("Prospect declined at this time. Scheduled for future re-engagement.", cleanNotes),
      };

    case "ENROLLED":
      return {
        suggestedAction: "Send enrollment packet and hand off to enrollment specialist",
        followUpDate: null,
        draftMessage:
          `Welcome to Coastal Debt Solutions! We're excited to help ${businessName}. ` +
          `Your enrollment specialist will be in touch within 24 hours.`,
        autoNotes: buildAutoNotes("Prospect enrolled in debt settlement program.", cleanNotes),
      };

    case "VOICEMAIL":
      return {
        suggestedAction: "Try calling again tomorrow — left voicemail",
        followUpDate: addDays(1),
        draftMessage:
          `Hi ${contactName}, I tried reaching you regarding debt settlement options ` +
          `for ${businessName}. Please call us back at your convenience.`,
        autoNotes: buildAutoNotes("Left voicemail. Will attempt again next business day.", cleanNotes),
      };

    case "NO_ANSWER":
      return {
        suggestedAction: "Attempt again tomorrow — no answer on this attempt",
        followUpDate: addDays(1),
        draftMessage: "",
        autoNotes: buildAutoNotes("No answer. Will retry.", cleanNotes),
      };

    case "DNC":
      return {
        suggestedAction: "Mark as DNC — do not contact again",
        followUpDate: null,
        draftMessage: "",
        autoNotes: buildAutoNotes("Prospect requested Do Not Contact. Removed from all outreach.", cleanNotes),
      };

    default:
      return {
        suggestedAction: "Review call and determine next steps",
        followUpDate: addDays(1),
        draftMessage: "",
        autoNotes: buildAutoNotes("Call completed — disposition not set.", cleanNotes),
      };
  }
}

function buildAutoNotes(aiSummary: string, agentNotes: string): string {
  if (agentNotes) {
    return `[AI Summary] ${aiSummary}\n\n[Agent Notes] ${agentNotes}`;
  }
  return `[AI Summary] ${aiSummary}`;
}
