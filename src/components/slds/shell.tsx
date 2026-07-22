"use client";

import { SldsHeader } from "./header";
import { DockedComposer } from "@/components/emails/docked-composer";

export function SldsShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string;
}) {
  const initials = (userName ?? "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#f3f3f3" }}>
      <SldsHeader userInitials={initials} userName={userName} />
      <main style={{ padding: 12, maxWidth: "100%" }}>{children}</main>
      <DockedComposer />
    </div>
  );
}
