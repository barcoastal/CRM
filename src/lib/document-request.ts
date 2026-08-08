/**
 * Helpers for the document-request feature: a secure no-login link emailed to
 * a lead/client so they can upload their own documents (loan docs, bank
 * statements, etc.) straight onto their Opportunity (and Account).
 *
 * Reuses the same Resend send-as wrapper as the e-sign flow
 * (src/lib/esign/send-email.ts) so transactional mail goes out the same way.
 */

/**
 * Absolute base URL for PUBLIC client-facing links. Always the branded
 * domain: a railway.app URL in an email asking for an SSN reads as phishing.
 */
export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.coastaldebt-tools.com";
  return raw.replace(/\/+$/, "");
}

/** Public, no-login URL a recipient visits to upload documents. */
export function uploadUrl(token: string): string {
  return `${appBaseUrl()}/upload/${token}`;
}

/** Public, no-login URL a recipient visits to fill in their info (address etc.). */
export function intakeUrl(token: string): string {
  return `${appBaseUrl()}/intake/${token}`;
}

/**
 * Shared branded email shell (Coastal Debt Resolve brand book: Future Blue
 * #3052FF, Cyan Blue #F2F4F9, Aeonik-first font stack). Plain inline-styled
 * table HTML so it lands cleanly in Gmail/Outlook without an MJML pipeline.
 */
function renderBrandedEmail(args: {
  heading: string;
  recipientName?: string | null;
  senderName?: string | null;
  intro: string;
  note?: string | null;
  ctaLabel: string;
  ctaUrl: string;
  expiresDays?: number;
}): string {
  const first = (args.recipientName ?? "").split(" ")[0] || "there";
  const logo = `${appBaseUrl()}/email/coastal-logo.png`;
  const font = "'Aeonik','Helvetica Neue',Helvetica,Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const trust = `<tr><td style="padding:4px 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F4F9;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 6px;font-family:${font};font-size:13px;font-weight:600;color:#0b0b14;">&#128274;&nbsp; Your information is protected</p>
            <p style="margin:0;font-family:${font};font-size:13px;line-height:1.7;color:#1a1a2e;">
              &#10003;&nbsp; Encrypted end to end with bank-level SSL security<br/>
              &#10003;&nbsp; A private link created only for you, expiring automatically<br/>
              &#10003;&nbsp; Used solely to service your file, never shared or sold
            </p>
          </td></tr>
        </table>
      </td></tr>`;
  const note = args.note
    ? `<tr><td style="padding:0 40px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F4F9;border-radius:8px;">
          <tr><td style="padding:14px 18px;font-family:${font};font-size:14px;line-height:1.6;color:#1a1a2e;"><div style="color:#3052FF;font-weight:600;margin-bottom:2px;">A note from ${escapeHtml(args.senderName || "your advisor")}:</div><div style="white-space:pre-wrap;">${escapeHtml(args.note)}</div></td></tr>
        </table>
      </td></tr>`
    : "";
  const expiry = args.expiresDays
    ? `This secure link is unique to you and expires in ${args.expiresDays} days.`
    : "This secure link is unique to you.";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F2F4F9;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F4F9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e8f5;">
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #eef1f8;">
              <img src="${logo}" alt="Coastal Debt Resolve" width="200" style="display:block;width:200px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 8px;">
              <h1 style="margin:0 0 16px;font-family:${font};font-size:22px;line-height:1.3;font-weight:600;color:#0b0b14;">${escapeHtml(args.heading)}</h1>
              <p style="margin:0 0 12px;font-family:${font};font-size:15px;line-height:1.65;color:#1a1a2e;">Hi ${escapeHtml(first)},</p>
              <p style="margin:0 0 20px;font-family:${font};font-size:15px;line-height:1.65;color:#1a1a2e;">${args.intro}</p>
            </td>
          </tr>
          ${note}
          <tr>
            <td style="padding:16px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:#3052FF;border-radius:8px;">
                  <a href="${args.ctaUrl}" style="display:inline-block;padding:14px 32px;font-family:${font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(args.ctaLabel)}</a>
                </td></tr>
              </table>
              <p style="margin:8px 0 0;font-family:${font};font-size:12px;color:#6b7280;">&#128274; Secured with 256-bit SSL encryption</p>
            </td>
          </tr>
          ${trust}
          <tr>
            <td style="padding:20px 40px 8px;">
              <p style="margin:0 0 4px;font-family:${font};font-size:12px;line-height:1.5;color:#6b7280;">Button not working? Copy and paste this link into your browser:</p>
              <p style="margin:0 0 16px;font-family:${font};font-size:12px;line-height:1.5;color:#3052FF;word-break:break-all;"><a href="${args.ctaUrl}" style="color:#3052FF;text-decoration:underline;">${args.ctaUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0;font-family:${font};font-size:12px;line-height:1.6;color:#6b7280;">
                &#128274; ${expiry} No account or password is needed.<br/>
                Questions? Just reply to this email and we will help.
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
          <tr>
            <td style="padding:20px 24px 8px;text-align:center;">
              <p style="margin:0 0 4px;font-family:${font};font-size:12px;font-weight:600;color:#1a1a2e;">Coastal Debt Resolve</p>
              <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#8a93a6;">
                We walk with you from first call to final payment.<br/>
                You received this email because our team is working on your file.
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function renderDocRequestHtml(args: {
  recipientName?: string | null;
  senderName?: string | null;
  message?: string | null;
  uploadUrl: string;
  expiresDays?: number;
}): string {
  const sender = escapeHtml(args.senderName || "Your advisor");
  return renderBrandedEmail({
    heading: "We need a few documents from you",
    recipientName: args.recipientName,
    senderName: args.senderName,
    intro: `${sender} at Coastal Debt Resolve is working on your file and needs a few documents to keep things moving. Use the secure button below to upload them straight from your phone or computer.`,
    note: args.message,
    ctaLabel: "Upload my documents",
    ctaUrl: args.uploadUrl,
    expiresDays: args.expiresDays ?? 14,
  });
}

export function renderInfoRequestHtml(args: {
  recipientName?: string | null;
  senderName?: string | null;
  message?: string | null;
  intakeUrl: string;
  requestedFields?: string[];
  expiresDays?: number;
}): string {
  const sender = escapeHtml(args.senderName || "Your advisor");
  return renderBrandedEmail({
    heading: "Please confirm your information",
    recipientName: args.recipientName,
    senderName: args.senderName,
    intro: `${sender} at Coastal Debt Resolve needs a few details from you to move your file forward. It takes about a minute using the secure button below.`,
    note: args.message,
    ctaLabel: "Confirm my information",
    ctaUrl: args.intakeUrl,
    expiresDays: args.expiresDays ?? 14,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
