import { NextRequest, NextResponse } from "next/server";
import { authenticateSalesforcePilot } from "@/lib/esign/salesforce/auth";
import { snapshotSchema, snapshotAllowed } from "@/lib/esign/salesforce/policy";
import { prepareSalesforcePilot } from "@/lib/esign/salesforce/prepare";
import { esignPublicUrl } from "@/lib/esign/public-url";
export async function POST(req: NextRequest) {
  const pilot = await authenticateSalesforcePilot(req.headers);
  if (!pilot)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 1000000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > 1000000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const parsed = snapshotSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Review the Salesforce contract data: " +
          parsed.error.issues
            .slice(0, 4)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
      },
      { status: 400 },
    );
  if (!snapshotAllowed(parsed.data, pilot))
    return NextResponse.json(
      {
        error:
          "This pilot only supports the configured test Opportunity, sender and recipient.",
      },
      { status: 403 },
    );
  try {
    const packet = await prepareSalesforcePilot(parsed.data, pilot);
    return NextResponse.json({
      id: packet.id,
      status: packet.status,
      url: `${esignPublicUrl()}/envelopes/packets/${packet.id}`,
    });
  } catch (e) {
    const message =
      e instanceof Error && e.message.startsWith("Missing templates:")
        ? e.message
        : "Packet preparation failed. Retry with the same request.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
