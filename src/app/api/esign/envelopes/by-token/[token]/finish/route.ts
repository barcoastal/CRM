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
import { randomUUID } from "node:crypto";
import { signingInput, requiredFieldsError } from "@/lib/esign/signing-input";
import { DISCLOSURE_VERSION, DISCLOSURE_TEXT } from "@/lib/esign/disclosure";
import { verifiedPreparedPdf, signingFieldsHash, isSignable, readProof, proofCookie, sha256 } from "@/lib/esign/evidence";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { signedDir, ensureESignDirs } from "@/lib/esign/storage";
import { renderSignedCopyHtml, renderSenderNotificationHtml, sendESignEmail } from "@/lib/esign/send-email";
import { notify } from "@/lib/notifications/notify";
import { collectTarget } from "@/lib/esign/collect-targets";
import { advanceOppStage } from "@/lib/opportunity-stage";

type Box = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  collectTo?: string;
};

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

  if (!isSignable(envelope)) {
    return NextResponse.json(
      { error: `Envelope is ${envelope.status} and cannot be signed.` },
      { status: 400 },
    );
  }

  const parsed = signingInput.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:"A valid signature, full name, and acceptance of the current signing disclosure are required."},{status:400});
  const body = parsed.data;
  const requiredError = requiredFieldsError(body,envelope);
  if (requiredError) return NextResponse.json({error:requiredError},{status:400});
  if (!envelope.viewedAt) return NextResponse.json({error:"Open and review the document before signing."},{status:428});
  const proof = readProof(request.cookies.get(proofCookie(envelope.id))?.value,envelope);
  if (!proof) return NextResponse.json({error:"Email verification expired. Reload and verify your email again."},{status:401});
  if (proof.fieldsHash !== signingFieldsHash(envelope)) return NextResponse.json({error:"Signing fields changed. Reload and verify this document again."},{status:409});
  const verification = await prisma.envelopeEvent.findFirst({where:{id:proof.eventId,envelopeId:envelope.id,eventType:"EMAIL_VERIFIED"}});
  if (!verification) return NextResponse.json({error:"Email verification required."},{status:401});

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
  let preparedHash: string;
  let signedHash: string;
  try {
    if (!envelope.preparedPdfPath) {
      throw new Error("Envelope has no prepared PDF on disk.");
    }
    const prepared = await verifiedPreparedPdf(envelope.preparedPdfPath);
    preparedHash = prepared.hash;
    if (preparedHash !== proof.documentHash) throw new Error("Document changed after verification");
    const preparedBuf = prepared.bytes;
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
      if (!Number.isInteger(oneBased) || oneBased < 1 || oneBased > pages.length) throw new Error("Invalid signing field page");
      const idx = oneBased - 1;
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

    // Free-text fields the signer filled in.
    const textBoxes = (envelope.textBoxes ?? []) as unknown as Box[];
    const textValues = body.textValues ?? {};
    textBoxes.forEach((box, i) => {
      const txt = (textValues[String(i)] ?? "").toString();
      if (!txt.trim()) return;
      // Size text to fit the box height; baseline sits a couple points up from
      // the box bottom so it reads on the line.
      const size = Math.min(12, Math.max(8, box.height ? box.height - 8 : 11));
      pageAt(box.page).drawText(txt, {
        x: box.x + 2,
        y: box.y + Math.max(2, (box.height - size) / 2),
        size,
        font: helvetica,
        color: rgb(0.04, 0.04, 0.04),
      });
    });

    // Checkbox fields the signer ticked → stamp an "X".
    const checkboxBoxes = (envelope.checkboxBoxes ?? []) as unknown as Box[];
    const checkboxValues = body.checkboxValues ?? {};
    checkboxBoxes.forEach((box, i) => {
      if (!checkboxValues[String(i)]) return;
      const size = Math.min(14, Math.max(9, box.height ? box.height + 1 : 12));
      pageAt(box.page).drawText("X", {
        x: box.x + Math.max(1, (box.width - size * 0.55) / 2),
        y: box.y + Math.max(1, (box.height - size) / 2),
        size,
        font: helveticaBold,
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
      ["Signer Name", body.fullName],
      ["Signer Email", envelope.signerEmail],
      ["Authentication", "Email one-time code"],
      ["Email Verified At", proof.verifiedAt],
      ["Disclosure Version", DISCLOSURE_VERSION],
      ["Sent At", fmt(envelope.sentAt)],
      ["Viewed At", fmt(envelope.viewedAt)],
      ["Signed At", now.toISOString()],
      ["Signer IP", ip],
      ["Signer User Agent", ua.slice(0, 100)],
    ];
    for (const [label, value] of rows) {
      cert.drawText(label, { x: 50, y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
      // Wrap long evidence values rather than clipping them off the page.
      const chunks = value.match(/.{1,62}/g) ?? [""];
      for (const chunk of chunks) { cert.drawText(chunk, { x: 200, y, size: 9, font: helvetica, color: rgb(0.04, 0.04, 0.04) }); y -= 12; }
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
    cert.drawText("Prepared document SHA-256:", {x:50,y,size:9,font:helveticaBold});
    y -= 14;
    cert.drawText(preparedHash, {x:50,y,size:8,font:helvetica});
    y -= 24;
    cert.drawText("Consent and authority confirmed at signing. Full disclosure follows.", {x:50,y,size:9,font:helvetica});
    const disclosurePage = pdfDoc.addPage([612,792]);
    disclosurePage.drawText(`Electronic signing disclosure ${DISCLOSURE_VERSION}`, {x:50,y:740,size:14,font:helveticaBold});
    let dy=708;
    const words=DISCLOSURE_TEXT.split(" "); let line="";
    for(const word of words) {
      const next = line ? `${line} ${word}` : word;
      if(helvetica.widthOfTextAtSize(next,11)>500) { disclosurePage.drawText(line,{x:50,y:dy,size:11,font:helvetica}); dy-=18;line=word; } else line=next;
    }
    if(line) disclosurePage.drawText(line,{x:50,y:dy,size:11,font:helvetica});
    y -= 20;
    const footer = "This certificate confirms the above document was signed electronically using Coastal CRM.";
    cert.drawText(footer, { x: 50, y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

    const out = await pdfDoc.save();

    await ensureESignDirs();
    signedFilename = `${envelope.id}-${randomUUID()}-signed.pdf`;
    signedHash = sha256(Buffer.from(out));
    await fs.writeFile(path.join(signedDir(), signedFilename), Buffer.from(out), {flag:"wx"});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { lastError: msg.slice(0, 500) },
    });
    return NextResponse.json({ error: "Unable to finalize this document. Contact the sender." }, { status: 500 });
  }

  // Mark complete + record audit events.
  // Compare-and-set prevents double signing and racing with withdrawal/decline.
  try {
    await prisma.$transaction(async tx => {
      const changed = await tx.envelope.updateMany({
        where:{id:envelope.id,status:{in:["SENT","VIEWED"]},OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]},
        data:{status:"COMPLETED",signedAt:now,completedAt:now,signedDocumentUrl:signedFilename,signatureImage:body.signature,signatureIp:ip||null,signatureUserAgent:ua||null,lastError:null},
      });
      if(changed.count!==1) throw new Error("Envelope is no longer available for signing");
      await tx.envelopeEvent.createMany({data:[
        {envelopeId:envelope.id,eventType:"CONSENT_ACCEPTED",details:JSON.stringify({version:DISCLOSURE_VERSION,text:DISCLOSURE_TEXT,fullName:body.fullName,documentHash:preparedHash,verificationEventId:proof.eventId,acceptedAt:now.toISOString()}),ipAddress:ip,userAgent:ua},
        {envelopeId:envelope.id,eventType:"SIGNED",details:JSON.stringify({fullName:body.fullName,email:envelope.signerEmail,verificationEventId:proof.eventId,preparedSha256:preparedHash,fieldsHash:proof.fieldsHash,signingFields:{signature:envelope.signatureBoxes,initial:envelope.initialBoxes,text:envelope.textBoxes,date:envelope.dateBoxes,checkbox:envelope.checkboxBoxes},signatureSha256:sha256(sigDecoded.buffer),initialSha256:sha256(initialDecoded.buffer),textValues:body.textValues,dateValues:body.dateValues,checkboxValues:body.checkboxValues}),ipAddress:ip,userAgent:ua},
        {envelopeId:envelope.id,eventType:"COMPLETED",details:JSON.stringify({signedFilename,signedSha256:signedHash,preparedSha256:preparedHash}),ipAddress:ip,userAgent:ua},
      ]});
    });
  } catch {
    // This attempt owns a unique file; never delete or overwrite a winner's PDF.
    await fs.unlink(path.join(signedDir(),signedFilename)).catch(()=>{});
    return NextResponse.json({error:"Document state changed or completion failed. Reload before trying again."},{status:409});
  }

  // Collect signer-entered values back onto the linked Account (overwrite).
  // Best-effort: a write-back failure must not block signing completion.
  if (envelope.accountId) {
    try {
      const accountUpdates: Record<string, string> = {};
      const textBoxesC = (envelope.textBoxes ?? []) as unknown as Box[];
      const textValuesC = body.textValues ?? {};
      textBoxesC.forEach((box, i) => {
        const target = collectTarget(box.collectTo);
        if (!target) return;
        const v = (textValuesC[String(i)] ?? "").toString().trim();
        if (v) accountUpdates[target.field] = v;
      });
      const checkboxBoxesC = (envelope.checkboxBoxes ?? []) as unknown as Box[];
      const checkboxValuesC = body.checkboxValues ?? {};
      checkboxBoxesC.forEach((box, i) => {
        const target = collectTarget(box.collectTo);
        if (!target || !checkboxValuesC[String(i)]) return;
        // A ticked checkbox writes its label as the value (e.g. "Checking").
        const v = (box.label ?? "").toString().trim();
        if (v) accountUpdates[target.field] = v;
      });
      if (Object.keys(accountUpdates).length > 0) {
        await prisma.account.update({ where: { id: envelope.accountId }, data: accountUpdates });
      }
    } catch {
      // Swallow — the document is signed; collection is secondary.
    }
  }

  // SF flow parity: completed signature moves the deal to "Contract Signed"
  // (forward-only) and stamps First Contract Signed Date if not already set.
  if (envelope.opportunityId) {
    await advanceOppStage(envelope.opportunityId, "Contract Signed", null).catch(async () => {
      await prisma.envelopeEvent.create({data:{envelopeId:envelope.id,eventType:"CRM_UPDATE_FAILED",details:"Could not advance opportunity stage after signing"}});
    });
    await prisma.opportunity
      .updateMany({
        where: { id: envelope.opportunityId, firstContractSignedDateOpp: null },
        data: { firstContractSignedDateOpp: now },
      })
      .catch(() => undefined);
  }

  // In-app notification to the envelope sender. The signer is external so
  // actorId stays null. Fire-and-forget; never throws.
  if (envelope.createdById) {
    void notify({
      recipientId: envelope.createdById,
      kind: "ENVELOPE_SIGNED",
      title: `${envelope.signerName} signed ${envelope.documentName}`,
      url: `/envelopes/${envelope.id}`,
      entityType: "Envelope",
      entityId: envelope.id,
      actorId: null,
    });
  }

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
