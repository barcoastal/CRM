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

export async function ensureDirs(): Promise<void> {
  await fs.mkdir(templatesDir(), { recursive: true });
  await fs.mkdir(signedDir(), { recursive: true });
}

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
