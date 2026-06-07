import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewSourceForm } from "./form";

export default async function NewMarketingSourcePage() {
  await auth();

  const [users, queues] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({
      where: { type: "QUEUE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          New Inbound Source
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
          <Link href="/marketing/sources" className="text-[#3052ff]">Sources</Link> / New
        </p>
      </div>

      <NewSourceForm users={users} queues={queues} />
    </div>
  );
}
