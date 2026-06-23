import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileP = promisify(execFile);

// soffice is the headless entrypoint; some images only expose `libreoffice`.
const SOFFICE_BINS = ["soffice", "libreoffice"];

/**
 * Convert a Word document (.docx / .doc) to PDF using headless LibreOffice.
 *
 * LibreOffice is installed in the container via nixpacks.toml. We give each
 * invocation its own temp working dir AND user-profile dir, so concurrent
 * conversions don't collide on the shared profile lock.
 */
export async function convertWordToPdf(input: Buffer, originalName: string): Promise<Buffer> {
  const work = await mkdtemp(path.join(tmpdir(), "esign-conv-"));
  const profile = await mkdtemp(path.join(tmpdir(), "lo-profile-"));
  try {
    const ext = (path.extname(originalName) || ".docx").toLowerCase();
    const inPath = path.join(work, `input${ext}`);
    await writeFile(inPath, input);

    let lastErr: unknown = null;
    for (const bin of SOFFICE_BINS) {
      try {
        await execFileP(
          bin,
          [
            "--headless",
            "--norestore",
            "--nolockcheck",
            `-env:UserInstallation=file://${profile}`,
            "--convert-to",
            "pdf",
            "--outdir",
            work,
            inPath,
          ],
          { timeout: 60_000, maxBuffer: 64 * 1024 * 1024 },
        );

        const files = await readdir(work);
        const pdfName = files.find((f) => f.toLowerCase().endsWith(".pdf"));
        if (!pdfName) throw new Error("LibreOffice produced no PDF output");
        const out = await readFile(path.join(work, pdfName));
        if (out.length < 4 || out.subarray(0, 4).toString("ascii") !== "%PDF") {
          throw new Error("Converted file is not a valid PDF");
        }
        return out;
      } catch (e) {
        lastErr = e;
        // try the next binary name
      }
    }
    throw new Error(
      `Word-to-PDF conversion failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    );
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
