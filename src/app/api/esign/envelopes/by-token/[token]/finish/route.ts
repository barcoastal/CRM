/**
 * Public Finish & Sign endpoint. Stamps the signer's signature, initials, and
 * date overlays onto the prepared PDF, appends a Certificate of Completion
 * page, and writes the signed blob into signedDir().
 *
 *   POST /api/esign/envelopes/by-token/:token/finish
 *     body: {
 *       signature: string;                       // data: URL PNG
 *       initial?: string;                        // data: URL PNG (defaults to signature)
 *       dateValues?: Record<string, string>;     // YYYY-MM-DD per dateBox index
 *       fullName?: string;
 *     }
 *
 * Returns { ok, signedPdfUrl }.
 *
 * Coordinate note: pdf-lib origin is bottom-left, which matches what we store
 * in signatureBoxes/initialBoxes/dateBoxes. Pages are 1-indexed in our JSON,
 * pdf-lib is 0-indexed (so subtract 1 when calling getPage).
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { readEnvelopePdf, signedDir, ensureESignDirs } from "@/lib/esign/storage";
import { renderSignedCopyHtml, renderSenderNotificationHtml, sendESignEmail } from "@/lib/esign/send-email";

type Box = { page: number; x: number; y: number; width: number; height: number; label?: string };

function decodeDataUrl(s: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(s);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

function pickIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { signingToken: token },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (envelope.status !== "SENT" && envelope.status !== "VIEWED") {
    return NextResponse.json(
      { error: `Envelope is ${envelope.status} and cannot be signed.` },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    signature?: string;
    initial?: string;
    dateValues?: Record<string, string>;
    fullName?: string;
  };

  if (!body.signature || !body.signature.startsWith("data:")) {
    return NextResponse.json({ error: "signature data URL required" }, { status: 400 });
  }

  const sigDecoded = decodeDataUrl(body.signature);
  if (!sigDecoded) {
    return NextResponse.json({ error: "Invalid signature data URL" }, { status: 400 });
  }
  const initialDecoded = body.initial?.startsWith("data:")
    ? decodeDataUrl(body.initial) ?? sigDecoded
    : sigDecoded;

  const ip = pickIp(request);
  const ua = request.headers.get("user-agent") ?? "";
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Stamp the prepared PDF + write to signedDir.
  let signedFilename: string;
  try {
    if (!envelope.preparedPdfPath) {
      throw new Error("Envelope has no prepared PDF on disk.");
    }
    const preparedBuf = await readEnvelopePdf(envelope.preparedPdfPath);
    const pdfDoc = await PDFDocument.load(preparedBuf);

    const sigImg = sigDecoded.mime.includes("jpeg") || sigDecoded.mime.includes("jpg")
      ? await pdfDoc.embedJpg(sigDecoded.buffer)
      : await pdfDoc.embedPng(sigDecoded.buffer);
    const initImg = initialDecoded === sigDecoded
      ? sigImg
      : initialDecoded.mime.includes("jpeg") || initialDecoded.mime.includes("jpg")
        ? await pdfDoc.embedJpg(initialDecoded.buffer)
        : await pdfDoc.embedPng(initialDecoded.buffer);

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const sigBoxes = (envelope.signatureBoxes ?? []) as unknown as Box[];
    const initBoxes = (envelope.initialBoxes ?? []) as unknown as Box[];
    const dateBoxes = (envelope.dateBoxes ?? []) as unknown as Box[];
    const dateValues = body.dateValues ?? {};

    const pages = pdfDoc.getPages();

    function pageAt(oneBased: number) {
      const idx = Math.max(0, Math.min(pages.length - 1, oneBased - 1));
      return pages[idx]!;
    }

    for (const box of sigBoxes) {
      pageAt(box.page).drawImage(sigImg, {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });
    }
    for (const box of initBoxes) {
      pageAt(box.page).drawImage(initImg, {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });
    }
    dateBoxes.forEach((box, i) => {
      const txt = dateValues[String(i)] ?? todayStr;
      pageAt(box.page).drawText(txt, {
        x: box.x,
        y: box.y,
        size: 11,
        font: helvetica,
        color: rgb(0.04, 0.04, 0.04),
      });
    });

    // Certificate of completion page (US Letter 612x792 pts).
    const cert = pdfDoc.addPage([612, 792]);
    let y = 740;
    cert.drawText("CERTIFICATE OF COMPLETION", {
      x: 50,
      y,
      size: 18,
      font: helveticaBold,
      color: rgb(0.04, 0.04, 0.04),
    });
    y -= 12;
    cert.drawLine({
      start: { x: 50, y },
      end: { x: 562, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 28;

    const fmt = (d: Date | null | undefined): string => (d ? d.toISOString() : "");
    const rows: Array<[string, string]> = [
      ["Envelope ID", envelope.id],
      ["Document", envelope.documentName],
      ["Signer Name", envelope.signerName],
      ["Signer Email", envelope.signerEmail],
      ["Signer Phone", envelope.signerPhone ?? ""],
      ["Sent At", fmt(envelope.sentAt)],
      ["Viewed At", fmt(envelope.viewedAt)],
      ["Signed At", now.toISOString()],
      ["Signer IP", ip],
      ["Signer User Agent", ua.slice(0, 100)],
    ];
    for (const [label, value] of rows) {
      cert.drawText(label, { x: 50, y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
      cert.drawText(value, { x: 200, y, size: 10, font: helvetica, color: rgb(0.04, 0.04, 0.04) });
      y -= 8;
      cert.drawLine({
        start: { x: 50, y },
        end: { x: 562, y },
        thickness: 0.4,
        color: rgb(0.85, 0.85, 0.85),
      });
      y -= 14;
    }

    y -= 12;
    const footer = "This certificate confirms the above document was signed electronically using Coastal CRM.";
    cert.drawText(footer, { x: 50, y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

    const out = await pdfDoc.save();

    await ensureESignDirs();
    signedFilename = `${envelope.id}-signed.pdf`;
    await fs.writeFile(path.join(signedDir(), signedFilename), Buffer.from(out));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { lastError: msg.slice(0, 500) },
    });
    return NextResponse.json({ error: "Failed to stamp PDF", details: msg }, { status: 500 });
  }

  // Mark complete + record audit events.
  await prisma.$transaction([
    prisma.envelope.update({
      where: { id: envelope.id },
      data: {
        status: "COMPLETED",
        signedAt: now,
        completedAt: now,
        signedDocumentUrl: signedFilename,
        signatureImage: body.signature,
        signatureIp: ip || null,
        signatureUserAgent: ua || null,
        lastError: null,
      },
    }),
    prisma.envelopeEvent.create({
      data: {
        envelopeId: envelope.id,
        eventType: "SIGNED",
        details: body.fullName ? `Signed by ${body.fullName}` : null,
        ipAddress: ip || null,
        userAgent: ua || null,
      },
    }),
    prisma.envelopeEvent.create({
      data: {
        envelopeId: envelope.id,
        eventType: "COMPLETED",
        details: `Certificate written: ${signedFilename}`,
        ipAddress: ip || null,
        userAgent: ua || null,
      },
    }),
  ]);

  // Fire dual-party email notifications. Failures don't roll back the signed
  // state; we just log an EMAIL_FAILED event so the dashboard can show it.
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com";
  const root = baseUrl.replace(/\/$/, "");
  const signedPdfUrl = `${root}/api/esign/envelopes/by-token/${envelope.signingToken}/signed-pdf`;
  const envelopeUrl = `${root}/envelopes/${envelope.id}`;
  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const senderEmail = envelope.createdBy?.email ?? null;
  const senderName = envelope.createdBy?.name ?? null;
  const fromAddress = senderEmail ? `${senderName ?? senderEmail} <${senderEmail}>` : defaultFrom;

  try {
    const signerRes = await sendESignEmail({
      from: fromAddress,
      to: envelope.signerEmail,
      subject: `Signed copy: ${envelope.documentName}`,
      html: renderSignedCopyHtml({
        signerName: envelope.signerName,
        documentName: envelope.documentName,
        signedPdfUrl,
      }),
      replyTo: senderEmail,
    });
    if (!signerRes.ok) {
      await prisma.envelopeEvent.create({
        data: {
          envelopeId: envelope.id,
          eventType: "EMAIL_FAILED",
          details: `Signer copy: ${signerRes.error ?? "unknown"}`,
        },
      });
    }
  } catch (e) {
    await prisma.envelopeEvent.create({
      data: {
        envelopeId: envelope.id,
        eventType: "EMAIL_FAILED",
        details: `Signer copy threw: ${e instanceof Error ? e.message : String(e)}`,
      },
    });
  }

  if (senderEmail) {
    try {
      const senderRes = await sendESignEmail({
        from: defaultFrom,
        to: senderEmail,
        subject: `${envelope.signerName} signed ${envelope.documentName}`,
        html: renderSenderNotificationHtml({
          senderName,
          signerName: envelope.signerName,
          signerEmail: envelope.signerEmail,
          documentName: envelope.documentName,
          envelopeUrl,
          signedPdfUrl,
          signedAt: now,
        }),
      });
      if (!senderRes.ok) {
        await prisma.envelopeEvent.create({
          data: {
            envelopeId: envelope.id,
            eventType: "EMAIL_FAILED",
            details: `Sender notify: ${senderRes.error ?? "unknown"}`,
          },
        });
      }
    } catch (e) {
      await prisma.envelopeEvent.create({
        data: {
          envelopeId: envelope.id,
          eventType: "EMAIL_FAILED",
          details: `Sender notify threw: ${e instanceof Error ? e.message : String(e)}`,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    signedPdfUrl: `/api/esign/envelopes/by-token/${envelope.signingToken}/signed-pdf`,
  });
}
