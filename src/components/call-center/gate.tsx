"use client";
import { usePathname } from "next/navigation";
import { CallCenterProvider } from "./provider";
export function CallCenterGate({
  enabled,
  canCall,
  children,
}: {
  enabled: boolean;
  canCall: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (enabled && canCall) || pathname.startsWith("/call-center") ? (
    <CallCenterProvider enabled={enabled}>{children}</CallCenterProvider>
  ) : (
    children
  );
}
