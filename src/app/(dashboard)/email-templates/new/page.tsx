import Link from "next/link";
import { ArrowLeft } from "@/components/icons/lucide";
import { TemplateEditor } from "../template-editor";

export const dynamic = "force-dynamic";

export default function NewEmailTemplatePage() {
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link
          href="/email-templates"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#3052ff] font-semibold mb-3"
        >
          <ArrowLeft className="size-3.5" />
          Back to Email Templates
        </Link>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          New Email Template
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          Author the subject and body, drop in merge fields, attach files.
        </p>
      </div>

      <TemplateEditor mode="new" attachments={[]} />
    </div>
  );
}
