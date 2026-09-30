import { textFieldError, type SigningBox } from "./fields";
import { z } from "zod";
import { DISCLOSURE_VERSION, isFullNameField } from "./disclosure";
const image = z
  .string()
  .max(2_000_000)
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/);
export const signingInput = z.object({
  signature: image,
  appliedFieldIds: z.array(z.string().max(80)).max(1000),
  initial: image.optional(),
  fullName: z.string().trim().min(2).max(150),
  consent: z.literal(true),
  disclosureVersion: z.literal(DISCLOSURE_VERSION),
  textValues: z.record(z.string(), z.string().trim().max(500)).default({}),
  dateValues: z
    .record(
      z.string(),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((v) => {
          const d = new Date(v);
          return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
        }),
    )
    .default({}),
  checkboxValues: z.record(z.string(), z.boolean()).default({}),
});
export function requiredFieldsError(
  body: z.infer<typeof signingInput>,
  envelope: {
    signatureBoxes: unknown;
    initialBoxes: unknown;
    textBoxes: unknown;
    dateBoxes: unknown;
    checkboxBoxes?: unknown;
  },
) {
  if (
    !Array.isArray(envelope.signatureBoxes) ||
    !envelope.signatureBoxes.length
  )
    return "No signature locations configured. Contact the sender.";
  if (
    Array.isArray(envelope.initialBoxes) &&
    envelope.initialBoxes.some((b) => b.required !== false) &&
    !body.initial
  )
    return "Adopt your initials before signing.";
  for (const [kind, boxes] of [
    ["signature", envelope.signatureBoxes],
    ["initial", envelope.initialBoxes],
  ] as const) {
    for (let i = 0; i < ((boxes ?? []) as unknown[]).length; i++)
      if (
        ((boxes ?? []) as { required?: boolean }[])[i]?.required !== false &&
        !body.appliedFieldIds.includes(`${kind}-${i}`)
      )
        return "Apply your signature or initials at every required location.";
  }
  const texts = (envelope.textBoxes ?? []) as SigningBox[];
  for (const [i, b] of texts.entries()) {
    const valueError = textFieldError(b, body.textValues[String(i)] ?? "");
    if (valueError) return valueError;
    if (isFullNameField(b)) body.textValues[String(i)] = body.fullName;
    if (b.required !== false && !body.textValues[String(i)]?.trim())
      return "Complete all required text fields.";
  }
  for (let i = 0; i < ((envelope.dateBoxes ?? []) as unknown[]).length; i++)
    if (!body.dateValues[String(i)]) return "Complete all date fields.";
  for (const [i, b] of (
    (envelope.checkboxBoxes ?? []) as { required?: boolean }[]
  ).entries())
    if (b.required === true && !body.checkboxValues[String(i)])
      return "Complete required checkboxes.";
  return null;
}
