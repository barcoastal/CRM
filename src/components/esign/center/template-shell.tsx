"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./center.module.css";
export function TemplateShell({
  children,
  library,
}: {
  children: React.ReactNode;
  library: string;
}) {
  const path = usePathname();
  if (path === "/templates/esign" || path === "/contracts/templates")
    return children;
  return (
    <>
      <Link
        className={styles.back}
        href={`/sign-docs?tab=templates&library=${library}`}
      >
        ← E-Sign Center / Templates
      </Link>
      {children}
    </>
  );
}
