import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TemplatesClient } from "./templates-client";

export const dynamic = "force-dynamic";

export default async function EmailCenterTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [email, sms] = await Promise.all([
    prisma.emailTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subject: true, bodyHtml: true, bodyText: true },
    }),
    prisma.smsTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, body: true, isActive: true },
    }),
  ]);

  return (
    <TemplatesClient
      emailTemplates={email.map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.bodyHtml ?? t.bodyText ?? "",
      }))}
      smsTemplates={sms.map((t) => ({ id: t.id, name: t.name, body: t.body, isActive: t.isActive }))}
    />
  );
}
