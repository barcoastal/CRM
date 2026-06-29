/**
 * Helpers for the document-request feature: a secure no-login link emailed to
 * a lead/client so they can upload their own documents (loan docs, bank
 * statements, etc.) straight onto their Opportunity (and Account).
 *
 * Reuses the same Resend send-as wrapper as the e-sign flow
 * (src/lib/esign/send-email.ts) so transactional mail goes out the same way.
 */

/** Absolute base URL of the CRM, for building the public upload link. */
export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://crm-production-613a.up.railway.app";
  return raw.replace(/\/+$/, "");
}

/** Public, no-login URL a recipient visits to upload documents. */
export function uploadUrl(token: string): string {
  return `${appBaseUrl()}/upload/${token}`;
}

/**
 * Render the "please upload your documents" email. Plain inline-styled HTML so
 * it lands cleanly in Gmail/Outlook without an MJML pipeline.
 */
export function renderDocRequestHtml(args: {
  recipientName?: string | null;
  senderName?: string | null;
  message?: string | null;
  uploadUrl: string;
}): string {
  const first = (args.recipientName ?? "").split(" ")[0] || "there";
  const greeting = `Hi ${first},`;
  const sender = args.senderName || "Coastal Debt";
  const note = args.message
    ? `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#3e3e3c;white-space:pre-wrap;">${escapeHtml(
        args.message,
      )}</p>`
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#080707;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:6px;border:1px solid #dddbda;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px 0;font-size:18px;color:#080707;">Please upload your documents</h1>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">
            ${escapeHtml(sender)} has requested some documents to move your file forward.
            Use the secure link below to upload them. You do not need to create an account.
          </p>
          ${note}
          <p style="margin:0 0 24px 0;">
            <a href="${args.uploadUrl}" style="display:inline-block;background:#0070d2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;font-weight:600;">
              Upload documents
            </a>
          </p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#706e6b;">
            Or copy and paste this link into your browser:
          </p>
          <p style="margin:0;font-size:12px;color:#0070d2;word-break:break-all;">${args.uploadUrl}</p>
        </td>
      </tr>
    </table>
    <p style="text-align:center;margin:16px auto 0;font-size:11px;color:#706e6b;">Coastal Debt Resolve</p>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
