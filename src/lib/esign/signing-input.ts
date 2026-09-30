import { z } from "zod";
import { DISCLOSURE_VERSION, isFullNameField } from "./disclosure";
const image = z.string().max(2_000_000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/);
export const signingInput = z.object({
  signature:image,
  initial:image.optional(),
  fullName:z.string().trim().min(2).max(150),
  consent:z.literal(true),
  disclosureVersion:z.literal(DISCLOSURE_VERSION),
  textValues:z.record(z.string(),z.string().trim().max(500)).default({}),
  dateValues:z.record(z.string(),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v);return !isNaN(d.getTime()) && d.toISOString().slice(0,10)===v;})).default({}),
  checkboxValues:z.record(z.string(),z.boolean()).default({}),
});
export function requiredFieldsError(body: z.infer<typeof signingInput>, envelope: {signatureBoxes:unknown;initialBoxes:unknown;textBoxes:unknown;dateBoxes:unknown}) {
  if (!Array.isArray(envelope.signatureBoxes) || !envelope.signatureBoxes.length) return "No signature locations configured. Contact the sender.";
  if (Array.isArray(envelope.initialBoxes) && envelope.initialBoxes.length && !body.initial) return "Adopt your initials before signing.";
  const texts=(envelope.textBoxes??[]) as {label?:string}[];
  for (const [i,b] of texts.entries()) {
    if (isFullNameField(b)) body.textValues[String(i)] = body.fullName;
    if (!body.textValues[String(i)]?.trim()) return "Complete all required text fields.";
  }
  for (let i=0;i<((envelope.dateBoxes??[]) as unknown[]).length;i++) if (!body.dateValues[String(i)]) return "Complete all date fields.";
  return null;
}
