"use client";

import { SldsHeader } from "./header";
import { DockedComposer } from "@/components/emails/docked-composer";
import { UtilityBar } from "./utility-bar";
import styles from "./shell.module.css";

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
    <div className={styles.shell}>
      <SldsHeader userInitials={initials} userName={userName} />
      <main className={`sf-shell-main ${styles.main}`}>{children}</main>
      <UtilityBar />
      <DockedComposer />
    </div>
  );
}
