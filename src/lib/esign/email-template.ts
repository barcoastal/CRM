export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function invitationHtml({
  sender,
  message,
  url,
  root,
}: {
  sender: string;
  message: string;
  url: string;
  root: string;
}) {
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#25232a"><div style="border-top:4px solid #2850a0;text-align:center;padding:36px"><img src="${escapeHtml(root)}/email/coastal-logo.png" alt="Coastal Debt Resolve" width="270"></div><div style="background:#2850a0;color:white;border-radius:16px;padding:40px;text-align:center"><p style="font-size:34px">✎</p><p>${escapeHtml(sender)} sent you documents to review and sign.</p><a style="display:inline-block;margin:24px;background:#ffcb22;color:#26222c;text-decoration:none;padding:17px 28px;border-radius:6px;font-weight:bold" href="${escapeHtml(url)}">Review Documents</a></div><div style="padding:30px;border:1px solid #ddd;border-radius:14px;margin-top:24px"><strong>${escapeHtml(sender)}</strong><p style="line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</p></div><p style="font-size:12px;margin-top:32px"><strong>Do not share this email</strong><br>This invitation contains a private signing link. Do not forward the link or share verification codes. Contact the sender if you were not expecting this request.</p><p style="font-size:12px">Sent using Coastal Debt's electronic signing service.</p></div>`;
}
