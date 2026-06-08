/**
 * Lightweight Resend wrapper for envelope signer notifications.
 *
 * The existing /api/emails/compose pipeline (src/lib/email-sender.ts) goes
 * through EmailMessage / mergeTokens / EmailTemplate. That is overkill for
 * envelope signer mail, which is a single one-off transactional send tied to
 * a signing token rather than a Lead/Opp conversation thread. Instead we call
 * Resend directly with the same env vars and same send-as-user pattern.
 */
export interface ESignEmailArgs {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}

export interface ESignEmailResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendESignEmail(args: ESignEmailArgs): Promise<ESignEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const body: Record<string, unknown> = {
    from: args.from,
    to: [args.to],
    subject: args.subject,
    html: args.html,
  };
  if (args.replyTo) body.reply_to = args.replyTo;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: data.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, providerMessageId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/**
 * Render the default "please sign" email body. Plain inline-styled HTML so it
 * lands well in Gmail and Outlook without needing an MJML pipeline.
 */
export function renderSignRequestHtml(args: {
  signerName: string;
  senderName?: string | null;
  senderEmail?: string | null;
  documentName: string;
  signingUrl: string;
}): string {
  const greeting = `Hi ${args.signerName.split(" ")[0] || "there"},`;
  const senderLine = args.senderName
    ? `${args.senderName}${args.senderEmail ? ` (${args.senderEmail})` : ""}`
    : "Coastal Debt";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#080707;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:6px;border:1px solid #dddbda;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px 0;font-size:18px;color:#080707;">Document ready to sign</h1>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">
            ${senderLine} has sent you <strong>${args.documentName}</strong> to review and sign.
          </p>
          <p style="margin:0 0 24px 0;">
            <a href="${args.signingUrl}" style="display:inline-block;background:#0070d2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;font-weight:600;">
              Review and sign
            </a>
          </p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#706e6b;">
            Or copy and paste this link into your browser:
          </p>
          <p style="margin:0;font-size:12px;color:#0070d2;word-break:break-all;">${args.signingUrl}</p>
        </td>
      </tr>
    </table>
    <p style="text-align:center;margin:16px auto 0;font-size:11px;color:#706e6b;">Coastal Debt Resolve</p>
  </body>
</html>`;
}

/**
 * Render the signer-facing "your signed copy" email. Sent immediately after
 * the signer hits Finish & Sign and the stamped PDF is written. We link to
 * the signed PDF endpoint instead of attaching, which keeps Resend payloads
 * small and avoids base64 round-tripping.
 */
export function renderSignedCopyHtml(args: {
  signerName: string;
  documentName: string;
  signedPdfUrl: string;
}): string {
  const greeting = `Hi ${args.signerName.split(" ")[0] || "there"},`;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#080707;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:6px;border:1px solid #dddbda;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px 0;font-size:18px;color:#080707;">Your signed copy</h1>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">
            Thank you for signing <strong>${args.documentName}</strong>. A complete copy with the
            audit certificate is available at the link below.
          </p>
          <p style="margin:0 0 24px 0;">
            <a href="${args.signedPdfUrl}" style="display:inline-block;background:#0070d2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;font-weight:600;">
              Download signed copy
            </a>
          </p>
          <p style="margin:0;font-size:12px;color:#706e6b;word-break:break-all;">${args.signedPdfUrl}</p>
        </td>
      </tr>
    </table>
    <p style="text-align:center;margin:16px auto 0;font-size:11px;color:#706e6b;">Coastal Debt Resolve</p>
  </body>
</html>`;
}

/**
 * Render the sender (operator) notification when the signer completes the
 * envelope. Links into the CRM envelope detail page so the operator can
 * eyeball the audit log + signed PDF in one place.
 */
export function renderSenderNotificationHtml(args: {
  senderName: string | null;
  signerName: string;
  signerEmail: string;
  documentName: string;
  envelopeUrl: string;
  signedPdfUrl: string;
  signedAt: Date;
}): string {
  const greeting = `Hi ${args.senderName?.split(" ")[0] || "there"},`;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#080707;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:6px;border:1px solid #dddbda;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px 0;font-size:18px;color:#080707;">${args.signerName} signed ${args.documentName}</h1>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">
            <strong>${args.signerName}</strong> (${args.signerEmail}) signed
            <strong>${args.documentName}</strong> on ${args.signedAt.toLocaleString()}.
          </p>
          <p style="margin:0 0 24px 0;">
            <a href="${args.envelopeUrl}" style="display:inline-block;background:#0070d2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;font-weight:600;">
              View envelope
            </a>
            <a href="${args.signedPdfUrl}" style="display:inline-block;margin-left:8px;color:#0070d2;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;font-weight:600;border:1px solid #0070d2;">
              Download signed PDF
            </a>
          </p>
        </td>
      </tr>
    </table>
    <p style="text-align:center;margin:16px auto 0;font-size:11px;color:#706e6b;">Coastal Debt Resolve</p>
  </body>
</html>`;
}

/**
 * Render the signer-facing "you declined" / "we voided" notification email.
 * Used by both the decline and void flows.
 */
export function renderEnvelopeTerminatedHtml(args: {
  signerName: string;
  documentName: string;
  reason: string;
  voided: boolean;
}): string {
  const greeting = `Hi ${args.signerName.split(" ")[0] || "there"},`;
  const action = args.voided ? "withdrawn" : "declined";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#080707;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:6px;border:1px solid #dddbda;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px 0;font-size:18px;color:#080707;">Document ${action}</h1>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">
            <strong>${args.documentName}</strong> has been ${action}.
          </p>
          <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#706e6b;">
            Reason: ${args.reason}
          </p>
        </td>
      </tr>
    </table>
    <p style="text-align:center;margin:16px auto 0;font-size:11px;color:#706e6b;">Coastal Debt Resolve</p>
  </body>
</html>`;
}
