import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "@/components/icons/lucide";
import { NewMassEmailWizard } from "./new-wizard";

export default async function NewMassEmailPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const [templates, users] = await Promise.all([
    prisma.emailTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subject: true, folder: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link
          href="/emails/mass"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#3052ff] font-semibold mb-3"
        >
          <ArrowLeft className="size-3.5" />
          Back to Mass Email
        </Link>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          New Mass Email
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          Three quick steps: name + template, audience, preview and send.
        </p>
      </div>

      <NewMassEmailWizard
        templates={templates}
        users={users}
        defaultFromUserId={session.user.id}
      />
    </div>
  );
}
