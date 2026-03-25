"use client";

import { useState } from "react";
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile drawer */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content area */}
      <div className="ml-0 md:ml-[240px] transition-all duration-200">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
