/**
 * Signature-anchor detection for the contract packet. Authors drop DocuSign-style
 * anchor tokens in the Word docs wherever a field goes; after the packet is merged
 * to PDF we find each token's position and turn it into a signing box, then white
 * out the token so it never shows in the signed document.
 *
 * Anchor tokens (case-insensitive, optional index):
 *   \s\  \s1\  -> signature      (client signs; every \s\ gets the same signature)
 *   \i\  \i1\  -> initials
 *   \d\  \d1\  -> date signed
 *   \n\  \n1\  -> signer name    (fill-in text)
 *   \t\  \t1\  -> free text      (e.g. title)
 *
 * Boxes use the same shape as EnvelopeTemplate: { page (1-based), x, y, width,
 * height, label } in PDF points, origin bottom-left, (x,y) = lower-left.
 */
import { PDFDocument, rgb } from "pdf-lib";

export interface AnchorBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface AnchoredPacket {
  pdf: Buffer;
  signatureBoxes: AnchorBox[];
  initialBoxes: AnchorBox[];
  dateBoxes: AnchorBox[];
  textBoxes: AnchorBox[];
}

// \s\ \s1\ \i2\ \d\ \n\ \t\ — backslash, letter, optional digits, backslash.
const ANCHOR_RE = /\\([sidnt])(\d*)\\/gi;

type Kind = "signature" | "initial" | "date" | "name" | "text";
const KIND: Record<string, Kind> = { s: "signature", i: "initial", d: "date", n: "name", t: "text" };

interface Hit {
  kind: Kind;
  page: number; // 1-based
  x: number; // baseline left, PDF points (bottom-left origin)
  y: number;
  tokenWidth: number;
  fontHeight: number;
}

/** Extract anchor hits from a PDF using pdfjs text positions. */
async function findAnchorHits(pdfBuffer: Buffer): Promise<Hit[]> {
  // Legacy build + disabled worker for Node/serverless.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const hits: Hit[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    // Join items into one string, remembering where each item starts so we can
    // map a regex match back to the item that carries its position. This keeps
    // detection robust even when a token is split across text runs.
    let joined = "";
    const spans: { start: number; item: { str: string; transform: number[]; width: number; height: number } }[] = [];
    for (const raw of content.items) {
      const item = raw as { str: string; transform: number[]; width: number; height: number };
      if (typeof item.str !== "string") continue;
      spans.push({ start: joined.length, item });
      joined += item.str;
    }

    ANCHOR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ANCHOR_RE.exec(joined)) !== null) {
      const kind = KIND[m[1].toLowerCase()];
      if (!kind) continue;
      // The span whose range contains the match start carries the position.
      let span = spans[0];
      for (const s of spans) {
        if (s.start <= m.index) span = s;
        else break;
      }
      if (!span) continue;
      const t = span.item.transform; // [a,b,c,d,e,f]
      hits.push({
        kind,
        page: p,
        x: t[4],
        y: t[5],
        tokenWidth: span.item.width || 24,
        fontHeight: span.item.height || Math.abs(t[3]) || 10,
      });
    }
  }
  await doc.destroy?.();
  return hits;
}

/** Turn a hit into a signing box sized/placed for its kind. */
function boxFor(hit: Hit): AnchorBox {
  const { page, x, y } = hit;
  switch (hit.kind) {
    case "signature":
      return { page, x, y: y - 6, width: 200, height: 40, label: `Sign (page ${page})` };
    case "initial":
      return { page, x, y: y - 6, width: 64, height: 40, label: `Initial (page ${page})` };
    case "date":
      return { page, x, y: y - 2, width: 110, height: 16, label: `Date (page ${page})` };
    case "name":
      return { page, x, y: y - 2, width: 220, height: 16, label: `Full name (page ${page})` };
    default:
      return { page, x, y: y - 2, width: 200, height: 16, label: `Fill in (page ${page})` };
  }
}

/**
 * Detect anchors in a merged packet PDF, white them out, and return the signing
 * boxes. If no anchors are present the PDF is returned unchanged with empty box
 * arrays (caller decides how to handle a packet with no signature spots).
 */
export async function prepareAnchoredPacket(pdfBuffer: Buffer): Promise<AnchoredPacket> {
  const hits = await findAnchorHits(pdfBuffer);

  const signatureBoxes: AnchorBox[] = [];
  const initialBoxes: AnchorBox[] = [];
  const dateBoxes: AnchorBox[] = [];
  const textBoxes: AnchorBox[] = [];
  for (const hit of hits) {
    const box = boxFor(hit);
    if (hit.kind === "signature") signatureBoxes.push(box);
    else if (hit.kind === "initial") initialBoxes.push(box);
    else if (hit.kind === "date") dateBoxes.push(box);
    else textBoxes.push(box); // name + text both collected as fill-in text
  }

  // White out the raw anchor tokens so they never print in the signed document.
  const out = await PDFDocument.load(pdfBuffer);
  const pages = out.getPages();
  for (const hit of hits) {
    const page = pages[hit.page - 1];
    if (!page) continue;
    page.drawRectangle({
      x: hit.x - 1,
      y: hit.y - 3,
      width: hit.tokenWidth + 2,
      height: hit.fontHeight + 5,
      color: rgb(1, 1, 1),
    });
  }
  const pdf = Buffer.from(await out.save());

  return { pdf, signatureBoxes, initialBoxes, dateBoxes, textBoxes };
}
