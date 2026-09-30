import { sendESignEmail } from "./send-email";
import { invitationHtml } from "./email-template";
import { esignPublicUrl } from "./public-url";
export { invitationHtml, escapeHtml } from "./email-template";
export async function sendPacketInvitation(args: {
  email: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  token: string;
  idempotencyKey?: string;
}) {
  const root = esignPublicUrl();
  return sendESignEmail({
    from: process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>",
    idempotencyKey: args.idempotencyKey,
    replyTo: args.senderEmail,
    to: args.email,
    subject: args.subject,
    html: invitationHtml({
      sender: args.senderName,
      message: args.message,
      url: `${root}/sign/${args.token}`,
      root,
    }),
  });
}
