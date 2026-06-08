import { promises as fs } from "fs";
import path from "path";

/**
 * E-signature storage on disk.
 *
 * On Railway we mount a persistent volume at /data and write template PDFs
 * and signed PDFs underneath it. Locally we fall back to a project-relative
 * folder so dev does not need a writable /data.
 *
 * Both directories can be overridden with env vars for tests / staging.
 */

export function templatesDir(): string {
  return (
    process.env.ESIGN_TEMPLATES_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data/esign-templates"
      : path.join(process.cwd(), ".data", "esign-templates"))
  );
}

export function signedDir(): string {
  return (
    process.env.ESIGN_SIGNED_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data/esign-signed"
      : path.join(process.cwd(), ".data", "esign-signed"))
  );
}

/**
 * Per-envelope prepared (merged-but-not-signed) PDFs live here. Separate from
 * templates so deleting a template never collides with envelope artefacts, and
 * separate from signed PDFs so the chunk 3 signature stamping can target a
 * different folder cleanly.
 */
export function envelopeDir(): string {
  return (
    process.env.ESIGN_ENVELOPES_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data/esign-envelopes"
      : path.join(process.cwd(), ".data", "esign-envelopes"))
  );
}

export async function ensureDirs(): Promise<void> {
  await fs.mkdir(templatesDir(), { recursive: true });
  await fs.mkdir(signedDir(), { recursive: true });
  await fs.mkdir(envelopeDir(), { recursive: true });
}

/** Alias preferred by callers that want the broader name. */
export const ensureESignDirs = ensureDirs;

export async function saveTemplatePdf(
  buffer: Buffer,
  templateId: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  await ensureDirs();
  const filename = `${templateId}.pdf`;
  const abs = path.join(templatesDir(), filename);
  await fs.writeFile(abs, buffer);
  return { relativePath: filename, absolutePath: abs };
}

export async function readTemplatePdf(relativePath: string): Promise<Buffer> {
  const abs = path.join(templatesDir(), relativePath);
  return fs.readFile(abs);
}

export async function deleteTemplatePdf(relativePath: string): Promise<void> {
  const abs = path.join(templatesDir(), relativePath);
  await fs.unlink(abs).catch(() => null);
}

/**
 * Save a merged-but-not-signed envelope PDF. The relative filename returned
 * is what we persist on Envelope.preparedPdfPath. Always overwrites: callers
 * that re-merge a template (eg. a future "regenerate" action) get an updated
 * blob without leaking the old one.
 */
export async function saveEnvelopePdf(buffer: Buffer, envelopeId: string): Promise<string> {
  await ensureDirs();
  const filename = `${envelopeId}.pdf`;
  const abs = path.join(envelopeDir(), filename);
  await fs.writeFile(abs, buffer);
  return filename;
}

export async function readEnvelopePdf(relativePath: string): Promise<Buffer> {
  const abs = path.join(envelopeDir(), relativePath);
  return fs.readFile(abs);
}

export async function deleteEnvelopePdf(relativePath: string): Promise<void> {
  const abs = path.join(envelopeDir(), relativePath);
  await fs.unlink(abs).catch(() => null);
}
