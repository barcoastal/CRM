"use client";

import { Search, Bell, LogOut, Menu } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-[#eaedff] bg-white px-4 md:px-8 shadow-sm">
      {/* Hamburger — mobile only */}
      <button
        className="md:hidden flex size-10 items-center justify-center rounded-lg text-[#444656] transition-colors hover:bg-[#f2f3ff]"
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        <Menu className="size-5" />
      </button>

      {/* Search — full on desktop, icon-only on mobile */}
      <div className="relative flex-1 max-w-md">
        {/* Desktop search input */}
        <div className="hidden md:block relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#444656]" />
          <input
            type="search"
            placeholder="Search leads, clients, calls..."
            className="h-9 w-full rounded-lg bg-[#f2f3ff] pl-9 pr-4 text-[13.5px] text-[#131b2e] placeholder:text-[#444656] outline-none focus:ring-2 focus:ring-[#3052ff]/20 border-none"
          />
        </div>

        {/* Mobile search icon button */}
        <button
          className="md:hidden flex size-10 items-center justify-center rounded-lg text-[#444656] transition-colors hover:bg-[#f2f3ff]"
          aria-label="Search"
        >
          <Search className="size-5" />
        </button>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-3">
        {/* Notification bell */}
        <button
          className="relative flex size-10 items-center justify-center rounded-lg text-[#444656] transition-colors hover:bg-[#f2f3ff]"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-[#3052ff]" />
        </button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#0034e4] to-[#3052ff] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none"
              aria-label="User menu"
            >
              {getInitials(userName)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-[#131b2e]">
                  {userName}
                </p>
                <p className="text-xs text-[#444656]">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer text-[#444656]"
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
