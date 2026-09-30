import type { Prisma } from "@/generated/prisma/client";

export const CENTER_FILTERS = [
  ["all", "All documents"],
  ["pending", "Awaiting signature"],
  ["signed", "Signed"],
  ["sent", "Sent, not opened"],
  ["viewed", "Viewed"],
  ["draft", "Not sent"],
  ["expired", "Expired"],
  ["declined", "Declined"],
  ["voided", "Voided"],
] as const;
export function centerStatusWhere(
  status: string,
  now: Date,
): Prisma.EnvelopeWhereInput {
  const unexpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
  switch (status.toLowerCase()) {
    case "pending":
      return { status: { in: ["SENT", "VIEWED"] }, ...unexpired };
    case "signed":
      return { status: { in: ["SIGNED", "COMPLETED"] } };
    case "completed":
      return { status: "COMPLETED" };
    case "expired":
      return { status: { in: ["SENT", "VIEWED"] }, expiresAt: { lte: now } };
    case "sent":
      return { status: "SENT", ...unexpired };
    case "viewed":
      return { status: "VIEWED", ...unexpired };
    case "draft":
      return { status: "DRAFT" };
    case "declined":
      return { status: "DECLINED" };
    case "voided":
      return { status: "VOIDED" };
    default:
      return {};
  }
}
export function centerWhere(
  params: {
    status?: string;
    q?: string;
    templateId?: string;
    sent?: string;
    source?: string;
  },
  now: Date,
): Prisma.EnvelopeWhereInput {
  const filters: Prisma.EnvelopeWhereInput[] = [
    centerStatusWhere(params.status ?? "all", now),
  ];
  if (params.source === "coastal")
    filters.push({ OR: [{ externalSource: null }, { externalSource: "" }] });
  if (params.source === "docusign")
    filters.push({
      externalSource: { equals: "DOCUSIGN", mode: "insensitive" },
    });
  const q = params.q?.trim().slice(0, 200);
  if (q)
    filters.push({
      OR: ["documentName", "signerName", "signerEmail", "templateName"].map(
        (key) => ({ [key]: { contains: q, mode: "insensitive" } }),
      ),
    });
  if (params.templateId) filters.push({ templateId: params.templateId });
  if (params.sent === "today")
    filters.push({
      sentAt: {
        gte: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        ),
      },
    });
  return { AND: filters };
}
export function centerStatus(
  row: { status: string; expiresAt: Date | null },
  now: Date,
) {
  if (
    ["SENT", "VIEWED"].includes(row.status) &&
    row.expiresAt &&
    row.expiresAt <= now
  )
    return "Expired";
  return (
    (
      {
        DRAFT: "Not sent",
        SENT: "Sent",
        VIEWED: "Viewed",
        SIGNED: "Signed",
        COMPLETED: "Completed",
        DECLINED: "Declined",
        VOIDED: "Voided",
      } as Record<string, string>
    )[row.status] ?? row.status
  );
}
export function centerPage(value?: string) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}
export function isEsignPath(path: string) {
  return [
    "/sign-docs",
    "/envelopes",
    "/templates/esign",
    "/contracts/templates",
  ].some((root) => path === root || path.startsWith(`${root}/`));
}
export function centerNavHref(href: string) {
  return isEsignPath(href) ? "/sign-docs" : href;
}

export function centerSource(source: string | null) {
  if (!source) return "Coastal E-Sign";
  return source.toUpperCase() === "DOCUSIGN" ? "DocuSign" : source;
}
