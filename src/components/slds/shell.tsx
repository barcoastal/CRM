"use client";

import { SldsHeader } from "./header";
import { SldsTabNav } from "./tab-nav";

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
      <SldsTabNav />
      <main style={{ padding: 16, maxWidth: "100%" }}>{children}</main>
    </div>
  );
}
