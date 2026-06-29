import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Content types browsers render inline. Everything else downloads even in "view" mode. */
const INLINE_OK = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "text/plain; charset=utf-8"]);

export function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/**
 * Stream a stored Document back to the client. `view` serves it inline (so the
 * browser renders PDFs/images in a tab) when the type supports it; otherwise it
 * downloads as an attachment.
 */
export async function serveDocument(
  doc: { name: string; filePath: string },
  view: boolean,
): Promise<NextResponse> {
  const abs = path.isAbsolute(doc.filePath) ? doc.filePath : path.join(process.cwd(), doc.filePath);
  try {
    const buf = await fs.readFile(abs);
    const mime = mimeFromName(doc.name);
    const inline = view && INLINE_OK.has(mime);
    const filename = doc.name.replace(/"/g, "");
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": inline ? mime : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 410 });
  }
}

/**
 * Delete a Document row and remove the physical file only when no other
 * Document row still references the same path. (The client-upload flow files
 * one physical file under both the Opportunity and its Account, so deleting
 * one copy must not break the other.)
 */
export async function deleteDocumentAndFile(docId: string, filePath: string): Promise<void> {
  await prisma.document.delete({ where: { id: docId } });
  const stillUsed = await prisma.document.count({ where: { filePath } });
  if (stillUsed === 0) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    await fs.unlink(abs).catch(() => undefined);
  }
}
