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

    const attempts: string[] = [];
    for (const bin of SOFFICE_BINS) {
      try {
        const { stdout, stderr } = await execFileP(
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
          {
            timeout: 60_000,
            maxBuffer: 64 * 1024 * 1024,
            // soffice needs a writable HOME for its profile/bootstrap.
            env: { ...process.env, HOME: profile },
          },
        );

        const files = await readdir(work);
        const pdfName = files.find((f) => f.toLowerCase().endsWith(".pdf"));
        if (!pdfName) {
          throw new Error(
            `no PDF produced (stdout: ${String(stdout).trim() || "—"}; stderr: ${String(stderr).trim() || "—"})`,
          );
        }
        const out = await readFile(path.join(work, pdfName));
        if (out.length < 4 || out.subarray(0, 4).toString("ascii") !== "%PDF") {
          throw new Error("converted file is not a valid PDF");
        }
        return out;
      } catch (e) {
        const err = e as NodeJS.ErrnoException & { stderr?: Buffer | string };
        if (err.code === "ENOENT") {
          attempts.push(`${bin}: not installed (ENOENT — soffice binary not on PATH)`);
        } else {
          const stderr = err.stderr ? String(err.stderr).trim() : "";
          attempts.push(`${bin}: ${stderr || err.message}`);
        }
      }
    }
    throw new Error(`Word-to-PDF conversion failed — ${attempts.join(" | ")}`);
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
