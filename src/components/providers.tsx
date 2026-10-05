"use client";

import { SessionProvider } from "next-auth/react";
import { DockedComposerProvider } from "@/components/emails/docked-composer-context";
import { UserPreviewBanner } from "@/components/admin/user-preview";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserPreviewBanner />
      <DockedComposerProvider>{children}</DockedComposerProvider>
    </SessionProvider>
  );
}
