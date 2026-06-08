import { promises as fs } from "fs";
import path from "path";

/**
 * Central Content Library storage on disk.
 *
 * On Railway we use the same persistent volume as e-sign (/data) but in our
 * own /data/files subtree so the two never collide. Locally we use a
 * project-relative .data/files folder.
 *
 * Layout:
 *   <root>/<documentId>/v<versionNumber>-<safeFilename>
 *
 * Saving the same path twice rejects (callers must bump versionNumber).
 */

export function filesDir(): string {
  return (
    process.env.FILES_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data/files"
      : path.join(process.cwd(), ".data", "files"))
  );
}

export async function ensureFilesDir(): Promise<void> {
  await fs.mkdir(filesDir(), { recursive: true });
}

/** Slugify a filename so it is safe on disk. Preserves extension. */
export function slugifyFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const safeBase = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100) || "file";
  const safeExt = ext.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 12);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

/**
 * Persist a buffer under <root>/<documentId>/v<versionNumber>-<safeFilename>.
 * Returns the path relative to the root (what we store on
 * ContentVersion.storagePath).
 *
 * Rejects if the target file already exists. Callers must bump versionNumber
 * to avoid clobbering history.
 */
export async function saveFile(
  buffer: Buffer,
  documentId: string,
  versionNumber: number,
  filename: string,
): Promise<string> {
  await ensureFilesDir();
  const safeName = slugifyFilename(filename);
  const subdir = documentId;
  const absSubdir = path.join(filesDir(), subdir);
  await fs.mkdir(absSubdir, { recursive: true });
  const rel = path.join(subdir, `v${versionNumber}-${safeName}`);
  const abs = path.join(filesDir(), rel);
  // Reject overwrite. fs.writeFile with flag "wx" throws EEXIST.
  await fs.writeFile(abs, buffer, { flag: "wx" });
  return rel;
}

export async function readFile(relativePath: string): Promise<Buffer> {
  const abs = path.join(filesDir(), relativePath);
  return fs.readFile(abs);
}

export async function deleteFile(relativePath: string): Promise<void> {
  const abs = path.join(filesDir(), relativePath);
  await fs.unlink(abs).catch(() => null);
}

/** Recursively remove the per-document folder. Used on document delete. */
export async function deleteDocumentFolder(documentId: string): Promise<void> {
  const abs = path.join(filesDir(), documentId);
  await fs.rm(abs, { recursive: true, force: true }).catch(() => null);
}

/** Allowed content types for upload. */
export const ALLOWED_CONTENT_TYPES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv",
  "text/plain",
  "application/octet-stream", // fallback when browsers misreport
]);

export const ALLOWED_EXTENSIONS = new Set<string>([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "docx",
  "xlsx",
  "csv",
  "txt",
]);

/** 50MB cap. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Validate a file before saving. Throws on rejection so the route handler can
 * return a 400 with the message.
 */
export function validateUpload(opts: {
  filename: string;
  contentType: string;
  byteSize: number;
}): void {
  if (opts.byteSize > MAX_FILE_BYTES) {
    throw new Error(`File too large: ${opts.byteSize} bytes exceeds 50MB cap`);
  }
  const dot = opts.filename.lastIndexOf(".");
  const ext = dot > 0 ? opts.filename.slice(dot + 1).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Extension not allowed: .${ext}`);
  }
  // Browsers sometimes send a generic octet-stream. Accept that, otherwise
  // require the type to be on the allow list.
  if (
    opts.contentType &&
    opts.contentType !== "application/octet-stream" &&
    !ALLOWED_CONTENT_TYPES.has(opts.contentType.toLowerCase())
  ) {
    throw new Error(`Content type not allowed: ${opts.contentType}`);
  }
}
