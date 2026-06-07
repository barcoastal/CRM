import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

type Folder = "all" | "inbox" | "sent" | "drafts" | "trash";

const ALLOWED: Folder[] = ["all", "inbox", "sent", "drafts", "trash"];

function whereFor(folder: Folder): Prisma.EmailMessageWhereInput {
  switch (folder) {
    case "inbox":
      return { direction: "INBOUND" };
    case "sent":
      return { direction: "OUTBOUND", status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] } };
    case "drafts":
      return { status: { in: ["DRAFT", "QUEUED"] } };
    case "trash":
      return { status: { in: ["FAILED", "BOUNCED", "COMPLAINED"] } };
    default:
      return {};
  }
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; id?: string }>;
}) {
  const params = await searchParams;
  const folder = (params.folder && ALLOWED.includes(params.folder as Folder)
    ? params.folder
    : "all") as Folder;

  if (!params.folder) {
    redirect("/emails?folder=all");
  }

  const [items, counts] = await Promise.all([
    prisma.emailMessage.findMany({
      where: whereFor(folder),
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true } },
        lead: { select: { id: true, contactName: true } },
        opportunity: { select: { id: true, recordType: true } },
        case: { select: { id: true, caseNumber: true, subject: true } },
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    Promise.all([
      prisma.emailMessage.count(),
      prisma.emailMessage.count({ where: whereFor("inbox") }),
      prisma.emailMessage.count({ where: whereFor("sent") }),
      prisma.emailMessage.count({ where: whereFor("drafts") }),
      prisma.emailMessage.count({ where: whereFor("trash") }),
    ]),
  ]);

  const [all, inbox, sent, drafts, trash] = counts;

  const selectedId = params.id ?? items[0]?.id ?? null;
  const selected = selectedId
    ? items.find((m) => m.id === selectedId) ??
      (await prisma.emailMessage.findUnique({
        where: { id: selectedId },
        include: {
          owner: { select: { id: true, name: true } },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, fullName: true } },
          lead: { select: { id: true, contactName: true } },
          opportunity: { select: { id: true, recordType: true } },
          case: { select: { id: true, caseNumber: true, subject: true } },
        },
      }))
    : null;

  const rows = items.map((m) => ({
    id: m.id,
    direction: m.direction,
    status: m.status,
    fromAddress: m.fromAddress,
    toAddresses: m.toAddresses,
    subject: m.subject,
    sentAt: (m.sentAt ?? m.createdAt).toISOString(),
    accountName: m.account?.name ?? null,
    leadName: m.lead?.contactName ?? null,
    contactName: m.contact?.fullName ?? null,
  }));

  const detail = selected
    ? {
        id: selected.id,
        direction: selected.direction,
        status: selected.status,
        fromAddress: selected.fromAddress,
        toAddresses: selected.toAddresses,
        cc: selected.cc ?? null,
        bcc: selected.bcc ?? null,
        subject: selected.subject,
        bodyHtml: selected.bodyHtml ?? null,
        bodyText: selected.bodyText ?? null,
        sentAt: (selected.sentAt ?? selected.createdAt).toISOString(),
        ownerName: selected.owner?.name ?? null,
        accountId: selected.account?.id ?? null,
        accountName: selected.account?.name ?? null,
        leadId: selected.lead?.id ?? null,
        leadName: selected.lead?.contactName ?? null,
        contactId: selected.contact?.id ?? null,
        contactName: selected.contact?.fullName ?? null,
        opportunityId: selected.opportunity?.id ?? null,
        caseId: selected.case?.id ?? null,
      }
    : null;

  return (
    <InboxClient
      folder={folder}
      counts={{ all, inbox, sent, drafts, trash }}
      rows={rows}
      selected={detail}
    />
  );
}
