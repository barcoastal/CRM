"use client";

import { useDockedComposer } from "./docked-composer-context";

interface Props {
  /** Pre-fill the To field */
  defaultTo?: string | null;
  /** Entity context — at least one. Determines which template tokens resolve. */
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  creditorId?: string;
  caseId?: string;
  /** Pre-fill subject */
  subject?: string;
  /** Pre-fill body HTML */
  bodyHtml?: string;
  /** Label for the Related To chip */
  relatedLabel?: string;
  /** Button label override */
  label?: string;
  /** Button style variant */
  variant?: "primary" | "ghost";
  /** No-op in the docked flow (kept for backwards compat with existing call sites) */
  templateCategory?: string;
}

/**
 * Trigger button for the SF-style docked email composer. The composer itself
 * is mounted once globally in the dashboard layout; this button just pushes
 * pre-fill state into the shared composer context.
 */
export function ComposeEmailButton({
  defaultTo,
  leadId,
  opportunityId,
  accountId,
  contactId,
  creditorId,
  caseId,
  subject,
  bodyHtml,
  relatedLabel,
  label = "Email",
  variant = "ghost",
}: Props) {
  const { openComposer } = useDockedComposer();

  function handleClick() {
    openComposer({
      to: defaultTo ?? "",
      subject: subject ?? "",
      bodyHtml: bodyHtml ?? "",
      leadId,
      opportunityId,
      accountId,
      contactId,
      creditorId,
      caseId,
      relatedLabel,
    });
  }

  return (
    <button onClick={handleClick} style={variant === "primary" ? btnPrimary : btnGhost}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ marginRight: label ? 6 : 0, verticalAlign: -1 }}
      >
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
      </svg>
      {label}
    </button>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "#0176d3",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  border: 0,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "#fff",
  color: "#0176d3",
  padding: "4px 10px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  border: "1px solid #c9c9c9",
  cursor: "pointer",
};
