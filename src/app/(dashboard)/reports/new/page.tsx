import Link from "next/link";
import { auth } from "@/lib/auth";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import {
  Users,
  Briefcase,
  Building2,
  TableProperties,
  CalendarClock,
  Calendar,
  FileText,
  ArrowLeft,
} from "@/components/icons/lucide";

const ICONS: Record<string, { Icon: typeof Users; gradient: string }> = {
  Lead: { Icon: Users, gradient: "linear-gradient(135deg, #0034e4, #3052ff)" },
  Opportunity: { Icon: Briefcase, gradient: "linear-gradient(135deg, #1a7d37, #2db84d)" },
  Account: { Icon: Building2, gradient: "linear-gradient(135deg, #8a6d00, #e0aa00)" },
  Case: { Icon: TableProperties, gradient: "linear-gradient(135deg, #942b00, #db5a2a)" },
  Task: { Icon: CalendarClock, gradient: "linear-gradient(135deg, #6332e0, #9a6dff)" },
  Event: { Icon: Calendar, gradient: "linear-gradient(135deg, #006e80, #00a6c0)" },
  Envelope: { Icon: FileText, gradient: "linear-gradient(135deg, #3a3a4f, #686883)" },
};

export default async function NewReportPickerPage() {
  await auth();

  const entries = Object.entries(OBJECT_METADATA);

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-[12px] text-[#3052ff] font-semibold mb-2"
        >
          <ArrowLeft className="size-3" />
          Back to Reports
        </Link>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Choose a report object
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          What do you want to report on. The object determines available columns, filters, and group-by fields.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map(([objectType, meta]) => {
          const { Icon, gradient } = ICONS[objectType] ?? { Icon: Users, gradient: "linear-gradient(135deg, #0034e4, #3052ff)" };
          return (
            <Link
              key={objectType}
              href={`/reports/builder?objectType=${objectType}`}
              className="group bg-white rounded-xl p-5 transition-shadow hover:shadow-lg"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="size-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: gradient }}
                >
                  <Icon className="size-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-bold text-[#131b2e] group-hover:text-[#3052ff]">
                    {meta.pluralLabel}
                  </div>
                  <p className="text-[12px] text-[#444656] mt-1">{meta.description}</p>
                  <div className="text-[11px] text-[#747474] mt-2 uppercase tracking-[0.4px] font-semibold">
                    {meta.fields.length} fields available
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
