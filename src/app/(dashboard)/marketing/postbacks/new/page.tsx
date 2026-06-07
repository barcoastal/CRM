import Link from "next/link";
import { auth } from "@/lib/auth";
import { PostbackForm } from "./form";
import { POSTBACK_EVENTS } from "@/lib/marketing/postback";

export default async function NewPostbackPage() {
  await auth();

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          New Postback Endpoint
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
          <Link href="/marketing/postbacks" className="text-[#3052ff]">Postbacks</Link> / New
        </p>
      </div>

      <PostbackForm events={[...POSTBACK_EVENTS]} />
    </div>
  );
}
