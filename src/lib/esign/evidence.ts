import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { envelopeDir, readEnvelopePdf } from "./storage";
export const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
export function mac(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Signing verification is not configured");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function safeEqual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export async function verifiedPreparedPdf(filename: string) {
  const bytes = await readEnvelopePdf(filename);
  const expected = (await fs.readFile(path.join(envelopeDir(), `${filename}.sha256`), "utf8")).trim();
  const hash = sha256(bytes);
  if (!safeEqual(hash, expected)) throw new Error("Prepared document integrity check failed");
  return { bytes, hash };
}
export function signingFieldsHash(e: {signatureBoxes?:unknown;initialBoxes?:unknown;dateBoxes?:unknown;textBoxes?:unknown;checkboxBoxes?:unknown}) {
  return sha256(JSON.stringify([e.signatureBoxes??[],e.initialBoxes??[],e.dateBoxes??[],e.textBoxes??[],e.checkboxBoxes??[]]));
}
export type VerificationProof = { envelopeId: string; email: string; documentHash: string; fieldsHash: string; verifiedAt: string; expires: number; eventId: string };
export function signProof(proof: VerificationProof) {
  const payload = Buffer.from(JSON.stringify(proof)).toString("base64url");
  return `${payload}.${mac(payload)}`;
}
export function readProof(value: string | undefined, envelope: {id: string; signerEmail: string}): VerificationProof | null {
  if (!value) return null;
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature || !safeEqual(mac(payload), signature)) return null;
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as VerificationProof;
    if (p.envelopeId !== envelope.id || p.email !== envelope.signerEmail || p.expires <= Date.now() || !p.documentHash || !p.fieldsHash || !p.eventId) return null;
    return p;
  } catch { return null; }
}
export const proofCookie = (id: string) => `esign_${id}`;
export function isSignable(e: { status: string; expiresAt: Date | null }, now = new Date()) {
  return ["SENT", "VIEWED"].includes(e.status) && (!e.expiresAt || e.expiresAt > now);
}
