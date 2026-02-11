"use client";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MobileSidebar } from "@/components/sidebar";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/dialer": "Dialer",
  "/campaigns": "Campaigns",
  "/calls": "Calls",
  "/reports": "Reports",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return "Dashboard";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const title = getPageTitle(pathname);
  const userName = session?.user?.name ?? "User";
  const userRole = (session?.user as { role?: string })?.role ?? "agent";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      <MobileSidebar />
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline-block">
                {userName}
              </span>
              <Badge variant="secondary" className="hidden text-xs sm:inline-flex capitalize">
                {userRole}
              </Badge>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer"
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
