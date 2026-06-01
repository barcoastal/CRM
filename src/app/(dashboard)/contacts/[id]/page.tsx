import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Smartphone, Briefcase, Cake } from "lucide-react";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      primaryAccount: true,
      owner: { select: { id: true, name: true, email: true } },
      accountRelations: {
        include: { account: { select: { id: true, name: true, recordType: true } } },
      },
    },
  });
  if (!contact) notFound();

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[12px] text-zinc-500 mb-1">
          <Link href="/contacts" className="hover:underline">Contacts</Link>
        </div>
        <h1 className="text-[1.75rem] font-bold tracking-tight" style={{ color: "#131b2e" }}>
          {contact.fullName}
        </h1>
        {contact.title && <p className="text-[13px] text-zinc-600 mt-0.5">{contact.title}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h2 className="font-semibold text-[14px] text-zinc-700 mb-3">Contact info</h2>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              {contact.email && <div className="flex items-center gap-2"><Mail className="size-4 text-zinc-400" />{contact.email}</div>}
              {contact.phone && <div className="flex items-center gap-2"><Phone className="size-4 text-zinc-400" />{contact.phone}</div>}
              {contact.mobilePhone && <div className="flex items-center gap-2"><Smartphone className="size-4 text-zinc-400" />{contact.mobilePhone}</div>}
              {contact.title && <div className="flex items-center gap-2"><Briefcase className="size-4 text-zinc-400" />{contact.title}</div>}
              {contact.birthdate && <div className="flex items-center gap-2"><Cake className="size-4 text-zinc-400" />{contact.birthdate.toLocaleDateString()}</div>}
            </dl>
          </section>

          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h2 className="font-semibold text-[14px] text-zinc-700 mb-3">Linked accounts ({contact.accountRelations.length})</h2>
            {contact.accountRelations.length === 0 ? (
              <p className="text-[13px] text-zinc-500">Not linked to any account yet.</p>
            ) : (
              <ul className="space-y-2">
                {contact.accountRelations.map((rel) => (
                  <li key={rel.id} className="flex items-center justify-between text-[13px]">
                    <Link href={`/accounts/${rel.account.id}`} className="text-[#0034e4] hover:underline font-medium">
                      {rel.account.name}
                    </Link>
                    <span className="text-zinc-500">{rel.role ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h3 className="font-semibold text-[13px] text-zinc-700 mb-2">Primary account</h3>
            {contact.primaryAccount ? (
              <Link href={`/accounts/${contact.primaryAccount.id}`} className="text-[#0034e4] hover:underline text-[13px]">
                {contact.primaryAccount.name}
              </Link>
            ) : <p className="text-[13px] text-zinc-500">—</p>}
          </section>
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h3 className="font-semibold text-[13px] text-zinc-700 mb-2">Owner</h3>
            <p className="text-[13px]">{contact.owner?.name ?? <span className="text-zinc-500">Unassigned</span>}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
