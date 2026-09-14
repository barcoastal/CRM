import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRevealSsn, maskSsn } from "@/lib/ssn-privacy";
import { SsnValue } from "./ssn-value";

export async function SsnField({ entity, id, masked }: { entity: string; id: string; masked: string | null }) {
  const session = await auth();
  const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isActive: true } }) : null;
  return <SsnValue key={`${entity}:${id}`} entity={entity} id={id} masked={maskSsn(masked)} canReveal={!!user?.isActive && canRevealSsn(user.role)} />;
}
