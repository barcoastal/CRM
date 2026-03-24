"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  Briefcase,
  Phone,
  Megaphone,
  PhoneCall,
  Calculator,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Opportunities", href: "/opportunities", icon: Target },
  { label: "Clients", href: "/clients", icon: Briefcase },
  { label: "Dialer", href: "/dialer", icon: Phone },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Calls", href: "/calls", icon: PhoneCall },
  { label: "Calculator", href: "/calculator", icon: Calculator },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-[#283044] transition-all duration-200",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-white/[0.08] px-6 py-6",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0034e4] to-[#3052ff] text-sm font-bold text-white">
          C
        </div>
        {!collapsed && (
          <span className="font-bold text-white tracking-tight text-[17px]">
            Coastal CRM
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-[#3052ff] text-white"
                  : "text-white/60 hover:bg-white/[0.08] hover:text-white",
                collapsed && "justify-center px-0"
              )}
            >
              <item.icon className="size-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-white/[0.08] p-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="size-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  return null;
}
