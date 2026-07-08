import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus, FileText } from "@/components/icons/lucide";

export const dynamic = "force-dynamic";

export default async function ESignTemplatesPage() {
  await auth();

  const templates = await prisma.envelopeTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      recordType: true,
      isActive: true,
      pageCount: true,
      mergeMapping: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            E-Sign Templates
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Reusable PDF contracts with merge fields and signature boxes.
          </p>
        </div>
        <Link
          href="/templates/esign/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold shadow-[0_8px_24px_rgba(48,82,255,0.25)]"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Plus className="size-4" />
          New Template
        </Link>
      </div>

      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Name", "Type", "Pages", "Fields", "Active", "Created"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] px-4 py-3.5 bg-[#f2f3ff]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="h-24 text-center text-[13px] text-[#444656] py-8 bg-white"
                >
                  No templates yet. Upload your first PDF to get started.
                </td>
              </tr>
            ) : (
              templates.map((t, idx) => {
                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]";
                const mapping = (t.mergeMapping ?? {}) as Record<string, unknown>;
                const fieldCount = Object.keys(mapping).length;
                return (
                  <tr key={t.id}>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      <Link
                        href={`/templates/esign/${t.id}`}
                        className="font-semibold text-[#131b2e] hover:text-[#3052ff] inline-flex items-center gap-2"
                      >
                        <FileText className="size-4 text-[#3052ff]" />
                        {t.name}
                      </Link>
                    </td>
                    <td className={`px-4 py-3.5 text-[12px] ${rowBg}`}>
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f2f3ff] text-[#3052ff]">
                        {t.recordType}
                      </span>
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}>
                      {t.pageCount}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}>
                      {fieldCount}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      {t.isActive ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[rgba(26,125,55,0.1)] text-[#1a7d37]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f2f3ff] text-[#444656]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}>
                      {new Date(t.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {t.createdBy?.name ? (
                        <span className="text-[#747474]"> by {t.createdBy.name}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
