import { prisma } from "@/lib/prisma";

export const USER_RECORD_TYPES = ["leads", "opportunities", "accounts", "contacts", "tasks", "cases"] as const;
export type UserRecordType = typeof USER_RECORD_TYPES[number];
export const USER_RECORD_PAGE_SIZE = 25;

export function userRecordType(value?: string): UserRecordType {
  return USER_RECORD_TYPES.includes(value as UserRecordType) ? value as UserRecordType : "leads";
}

/** Called only after the profile page's server-side admin authorization. */
export async function userOwnedRecords(userId: string, type: UserRecordType, page: number): Promise<Array<{ id: string; name: string; detail: string | null | undefined; status: string }>> {
  const pagination = { skip: (page - 1) * USER_RECORD_PAGE_SIZE, take: USER_RECORD_PAGE_SIZE, orderBy: [{ updatedAt: "desc" as const }, { id: "asc" as const }] };
  switch (type) {
    case "leads": return (await prisma.lead.findMany({ where: { assignedToId: userId }, ...pagination, select: { id: true, contactName: true, businessName: true, status: true } })).map(r => ({ id: r.id, name: r.contactName || r.businessName, detail: r.businessName, status: r.status }));
    case "opportunities": return (await prisma.opportunity.findMany({ where: { assignedToId: userId }, ...pagination, select: { id: true, name: true, stage: true, account: { select: { name: true } } } })).map(r => ({ id: r.id, name: r.name || r.account?.name || r.id, detail: r.account?.name, status: r.stage }));
    case "accounts": return (await prisma.account.findMany({ where: { ownerId: userId }, ...pagination, select: { id: true, name: true, clientStatus: true, isActive: true } })).map(r => ({ id: r.id, name: r.name, detail: r.isActive ? "" : "Deleted", status: r.clientStatus }));
    case "contacts": return (await prisma.contact.findMany({ where: { ownerId: userId }, ...pagination, select: { id: true, fullName: true, email: true } })).map(r => ({ id: r.id, name: r.fullName || r.id, detail: r.email, status: "" }));
    case "tasks": return (await prisma.task.findMany({ where: { ownerId: userId }, ...pagination, select: { id: true, subject: true, type: true, status: true } })).map(r => ({ id: r.id, name: r.subject, detail: r.type, status: r.status }));
    case "cases": return (await prisma.case.findMany({ where: { ownerId: userId }, ...pagination, select: { id: true, subject: true, caseNumber: true, status: true } })).map(r => ({ id: r.id, name: r.subject, detail: r.caseNumber, status: r.status }));
  }
}
