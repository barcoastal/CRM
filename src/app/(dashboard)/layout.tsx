import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <Sidebar />
      <div className="ml-[240px] transition-all duration-200">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
