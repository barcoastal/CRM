import { z } from "zod";
export const recipientSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(2).max(150),
  email: z.email().max(254),
  action: z.enum(["SIGN", "COPY"]),
  order: z.number().int().min(1).max(20),
});
export const packetFieldSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["signature", "initial", "date", "name", "text", "checkbox"]),
  page: z.number().int().min(1),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(8).max(1000),
  height: z.number().min(8).max(500),
  label: z.string().max(150).optional(),
  recipientId: z.string().max(80),
  inputType: z
    .enum(["text", "email", "number", "dropdown", "radio"])
    .optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  required: z.boolean().default(true),
});
export const packetConfigSchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(250),
        pageCount: z.number().int().positive(),
        startPage: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(20),
  recipients: z.array(recipientSchema).min(1).max(20),
  fields: z.array(packetFieldSchema).max(1000),
  subject: z.string().trim().min(1).max(200),
  message: z.string().max(10000),
  reminderDays: z.number().int().min(0).max(30),
  expiresDays: z.number().int().min(1).max(365),
});
export type PacketConfig = z.infer<typeof packetConfigSchema>;
export type PacketField = z.infer<typeof packetFieldSchema>;
export type PacketRecipient = z.infer<typeof recipientSchema>;
export function packetErrors(
  c: PacketConfig,
  pages: { width: number; height: number }[],
) {
  const errors: string[] = [];
  const signers = c.recipients.filter((r) => r.action === "SIGN");
  if (!signers.length) errors.push("Add at least one signer.");
  if (new Set(c.recipients.map((r) => r.id)).size !== c.recipients.length)
    errors.push("Recipient IDs must be unique.");
  if (new Set(signers.map((r) => r.order)).size !== signers.length)
    errors.push("Give each signer a distinct signing order.");
  if (new Set(c.fields.map((f) => f.id)).size !== c.fields.length)
    errors.push("Field IDs must be unique.");
  for (const r of signers)
    if (
      !c.fields.some(
        (f) => f.recipientId === r.id && f.kind === "signature" && f.required,
      )
    )
      errors.push(`Add a signature field for ${r.name}.`);
  for (const f of c.fields) {
    if (
      ["dropdown", "radio"].includes(f.inputType ?? "") &&
      (!f.options?.length || new Set(f.options).size !== f.options.length)
    )
      errors.push("Choice fields need distinct, nonempty options.");
    const p = pages[f.page - 1];
    if (!signers.some((r) => r.id === f.recipientId))
      errors.push("Every field must belong to a signer.");
    if (!p || f.x + f.width > p.width + 1 || f.y + f.height > p.height + 1)
      errors.push(`A field falls outside page ${f.page}.`);
  }
  return [...new Set(errors)];
}
