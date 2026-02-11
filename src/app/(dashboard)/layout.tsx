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
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-64">
        <Topbar />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
