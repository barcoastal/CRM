import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "@/components/icons/lucide";

async function createDashboard(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const description = String(formData.get("description") ?? "").trim() || null;
  const isShared = formData.get("isShared") === "on";
  const dash = await prisma.dashboard.create({
    data: {
      name,
      description,
      isShared,
      createdById: session.user.id,
    },
  });
  redirect(`/dashboards/${dash.id}`);
}

export default async function NewDashboardPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link
          href="/dashboards"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#3052ff] font-semibold mb-3"
        >
          <ArrowLeft className="size-3.5" />
          Back to Dashboards
        </Link>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          New Dashboard
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          Pick a name and short description. You can add tiles right after.
        </p>
      </div>

      <form
        action={createDashboard}
        className="bg-white rounded-xl p-6 space-y-5"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div>
          <label className="block text-[12px] font-semibold text-[#131b2e] mb-1.5">
            Name
          </label>
          <input
            name="name"
            required
            autoFocus
            placeholder="Sales Overview"
            className="w-full rounded border border-[#d8dde6] px-3 py-2 text-[13px] focus:outline-none focus:border-[#3052ff]"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#131b2e] mb-1.5">
            Description
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="What is this dashboard for?"
            className="w-full rounded border border-[#d8dde6] px-3 py-2 text-[13px] focus:outline-none focus:border-[#3052ff]"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isShared"
            id="isShared"
            defaultChecked
            className="rounded border-[#d8dde6]"
          />
          <label htmlFor="isShared" className="text-[12px] text-[#131b2e]">
            Shared with all users
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            Create Dashboard
          </button>
          <Link
            href="/dashboards"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-[#131b2e] text-[13px] font-semibold border border-[#d8dde6] bg-white"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
