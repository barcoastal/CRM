"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  Briefcase,
  Building2,
  UserSquare2,
  Landmark,
  Phone,
  Megaphone,
  PhoneCall,
  Calculator,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "@/components/icons/lucide";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Accounts", href: "/accounts", icon: Building2 },
  { label: "Contacts", href: "/contacts", icon: UserSquare2 },
  { label: "Opportunities", href: "/opportunities", icon: Target },
  { label: "Clients", href: "/clients", icon: Briefcase },
  { label: "Creditors", href: "/creditors", icon: Landmark },
  { label: "Dialer", href: "/dialer", icon: Phone },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Calls", href: "/calls", icon: PhoneCall },
  { label: "Calculator", href: "/calculator", icon: Calculator },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Shared nav content used by both desktop sidebar and mobile sheet
function SidebarNav({
  collapsed,
  onNavClick,
}: {
  collapsed?: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
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
              onClick={onNavClick}
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
    </>
  );
}

// Desktop fixed sidebar
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 bottom-0 z-50 hidden md:flex flex-col bg-[#283044] transition-all duration-200",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <SidebarNav collapsed={collapsed} />

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

// Mobile sheet drawer
export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="p-0 w-[240px] bg-[#283044] border-r-0 flex flex-col gap-0"
      >
        <SidebarNav onNavClick={onClose} />
      </SheetContent>
    </Sheet>
  );
}
