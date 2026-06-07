"use client";

import { SessionProvider } from "next-auth/react";
import { DockedComposerProvider } from "@/components/emails/docked-composer-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DockedComposerProvider>{children}</DockedComposerProvider>
    </SessionProvider>
  );
}
