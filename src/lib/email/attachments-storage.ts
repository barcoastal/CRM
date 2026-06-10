/**
 * Filesystem storage for email template attachments.
 *
 * On Railway we mount a volume at /data so the files survive deploys. In dev
 * we drop them under .data/email-attachments next to the repo. Override with
 * EMAIL_ATTACHMENTS_DIR if you want to point elsewhere.
 *
 * Filenames are slugified and prefixed with a random hex shard to avoid
 * collisions, plus the random prefix makes the file path unguessable for
 * defense in depth (the API still requires auth).
 */
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export function attachmentsDir(): string {
  return (
    process.env.EMAIL_ATTACHMENTS_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data/email-attachments"
      : path.join(process.cwd(), ".data", "email-attachments"))
  );
}

export async function ensureDir(): Promise<void> {
  await fs.mkdir(attachmentsDir(), { recursive: true });
}

function slugifyFilename(name: string): string {
  const idx = name.lastIndexOf(".");
  const base = idx > 0 ? name.slice(0, idx) : name;
  const ext = idx > 0 ? name.slice(idx).toLowerCase() : "";
  const slug = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase() || "file";
  // Keep extension as-is (limited to a safe shape).
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
  return `${slug}${safeExt}`;
}

/** Save the buffer to disk and return a path relative to attachmentsDir(). */
export async function saveAttachment(buffer: Buffer, filename: string): Promise<string> {
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment too large (max ${MAX_ATTACHMENT_BYTES} bytes)`);
  }
  await ensureDir();
  const prefix = randomBytes(8).toString("hex");
  const safeName = slugifyFilename(filename);
  const relativePath = `${prefix}-${safeName}`;
  const fullPath = path.join(attachmentsDir(), relativePath);
  await fs.writeFile(fullPath, buffer);
  return relativePath;
}

/** Read the file back from disk by its relative path. */
export async function readAttachment(relativePath: string): Promise<Buffer> {
  const full = resolveSafe(relativePath);
  return fs.readFile(full);
}

/** Best-effort delete; missing files are not an error. */
export async function deleteAttachment(relativePath: string): Promise<void> {
  const full = resolveSafe(relativePath);
  await fs.unlink(full).catch(() => undefined);
}

/** Resolve relative path and guard against path traversal. */
function resolveSafe(relativePath: string): string {
  const dir = attachmentsDir();
  const full = path.resolve(dir, relativePath);
  const dirResolved = path.resolve(dir);
  if (!full.startsWith(dirResolved + path.sep) && full !== dirResolved) {
    throw new Error("Invalid attachment path");
  }
  return full;
}
