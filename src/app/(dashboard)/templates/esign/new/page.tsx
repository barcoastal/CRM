import Link from "next/link";
import { auth } from "@/lib/auth";
import { NewTemplateForm } from "./form";

export default async function NewESignTemplatePage() {
  await auth();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          New E-Sign Template
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          <Link href="/templates/esign" className="text-[#3052ff]">
            E-Sign Templates
          </Link>{" "}
          / New
        </p>
      </div>

      <NewTemplateForm />
    </div>
  );
}
