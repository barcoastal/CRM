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
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#25232a"><div style="border-top:4px solid #2850a0;text-align:center;padding:36px"><img src="${escapeHtml(root)}/email/coastal-logo.png" alt="Coastal Debt Resolve" width="270"></div><div style="background:#2850a0;color:white;border-radius:16px;padding:40px;text-align:center"><p style="font-size:34px">✎</p><p>${escapeHtml(sender)} sent you documents to review and sign.</p><a style="display:inline-block;margin:24px;background:#ffcb22;color:#26222c;text-decoration:none;padding:17px 28px;border-radius:6px;font-weight:bold" href="${escapeHtml(url)}">Review Documents</a></div><div style="padding:30px;border:1px solid #ddd;border-radius:14px;margin-top:24px"><strong>${escapeHtml(sender)}</strong><p style="line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</p></div><p style="font-size:12px;margin-top:32px"><strong>Do not share this email</strong><br>This invitation contains a private signing link. Do not forward or share this link. Contact the sender if you were not expecting this request.</p><p style="font-size:12px">Sent using Coastal Debt's electronic signing service.</p></div>`;
}

export function completionHtml(args: {
  greeting: string;
  documentName: string;
  message: string;
  detail?: string;
  primaryUrl: string;
  primaryLabel: string;
  secondaryUrl?: string;
  secondaryLabel?: string;
  root: string;
}) {
  const e = escapeHtml;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f3f5fa;font-family:Arial,sans-serif;color:#192641;padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:white;border:1px solid #e0e5ef;border-radius:16px;overflow:hidden">
<tr><td style="padding:30px 24px;text-align:center;border-top:5px solid #2850a0"><img src="${e(args.root)}/email/coastal-logo.png" width="220" alt="Coastal Debt Resolve" style="max-width:100%;height:auto"></td></tr>
<tr><td style="padding:32px 24px;background:#2850a0;text-align:center;color:white"><div style="font-size:38px;line-height:1.2;color:#bdebd6">&#10003;</div><p style="margin:16px 0 8px;font-size:12px;font-weight:bold;letter-spacing:2px">COASTAL SIGN</p><h1 style="margin:0;font-size:28px;line-height:1.25">Signing complete</h1><p style="margin:12px 0 0;font-size:16px;line-height:1.6">${e(args.message)}</p></td></tr>
<tr><td style="padding:28px 24px"><p style="margin:0 0 20px;font-size:16px">${e(args.greeting)}</p><div style="padding:18px;background:#f5f7fb;border:1px solid #e4e9f2;border-radius:8px"><p style="margin:0 0 8px;color:#637089;font-size:12px;letter-spacing:1px">SIGNED DOCUMENT</p><p style="margin:0;font-size:17px;font-weight:bold;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">${e(args.documentName)}</p>${args.detail ? `<p style="margin:10px 0 0;font-size:13px;color:#637089;line-height:1.6;overflow-wrap:anywhere">${e(args.detail)}</p>` : ""}</div>
<p style="margin:24px 0 12px;text-align:center"><a href="${e(args.primaryUrl)}" style="display:block;background:#ffcb22;color:#192641;padding:16px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;line-height:1.4">${e(args.primaryLabel)}</a></p>
${args.secondaryUrl ? `<p style="margin:0;text-align:center"><a href="${e(args.secondaryUrl)}" style="display:block;border:1px solid #b8c8e2;color:#2850a0;padding:14px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">${e(args.secondaryLabel || "View document")}</a></p>` : ""}
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#637089;text-align:center">Keep a copy for your records. This email contains private document links; please do not forward it.</p></td></tr></table><p style="text-align:center;font-size:12px;line-height:1.6;color:#637089;margin:20px 0">Coastal Debt Resolve<br>Sent with Coastal Sign</p></body></html>`;
}
