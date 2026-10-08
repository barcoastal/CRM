import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLayoutEntity, layoutId, layoutStages, defaultFieldLayout } from "@/lib/record-field-layout";
import { getRecordFieldLayout } from "@/lib/record-field-layout-server";
import { RecordLayoutEditor } from "./editor";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ entity?: string; stage?: string }> }) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isActive: true } });
  if (!user?.isActive || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return <p>Administrator access required.</p>;
  const params = await searchParams;
  const entity = params.entity && isLayoutEntity(params.entity) ? params.entity : "Lead";
  const stage = params.stage && layoutStages[entity].includes(params.stage) ? params.stage : "*";
  const row = await prisma.pageLayout.findUnique({ where: { id: layoutId(entity, stage) } });
  const effective = await getRecordFieldLayout(entity, stage);
  return <RecordLayoutEditor key={`${entity}:${stage}:${row?.updatedAt.toISOString()}`} entity={entity} stage={stage} initial={{ ...defaultFieldLayout(entity), ...effective }} version={row?.updatedAt.toISOString() ?? null} inherited={stage !== "*" && !row} />;
}
