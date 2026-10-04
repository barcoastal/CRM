"use client";

import { SldsHeader } from "./header";
import { DockedComposer } from "@/components/emails/docked-composer";
import { usePathname } from "next/navigation";
import { UtilityBar } from "./utility-bar";

export function SldsShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string;
}) {
  const isLeadList = usePathname() === "/leads";
  const initials = (userName ?? "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={{ minHeight: isLeadList ? 0 : "100vh", height: isLeadList ? "100dvh" : undefined, display: isLeadList ? "flex" : undefined, flexDirection: "column", overflow: isLeadList ? "hidden" : undefined, background: "#f3f3f3" }}>
      <SldsHeader userInitials={initials} userName={userName} />
      <main
        className="sf-shell-main"
        style={{
          padding: isLeadList ? "6px 6px 46px" : 12,
          maxWidth: "100%",
          minHeight: isLeadList ? 0 : "calc(100vh - 94px)",
          flex: isLeadList ? 1 : undefined,
          display: isLeadList ? "flex" : undefined,
          flexDirection: "column",
          overflow: isLeadList ? "hidden" : undefined,
          // Org theme: the light periwinkle textured backdrop sits behind ALL
          // cards (verified at zoom on the live org), not plain gray.
          background:
            "repeating-linear-gradient(115deg, rgba(1,118,211,0.05) 0 14px, rgba(1,118,211,0.09) 14px 28px), linear-gradient(180deg, #dfe7f5 0%, #d8e2f3 100%)",
        }}
      >{children}</main>
      {isLeadList && <UtilityBar />}
      <DockedComposer />
    </div>
  );
}
