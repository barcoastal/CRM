import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coastal CRM",
  description: "Debt Settlement CRM & Dialer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Load SLDS CSS as a runtime <link> — Next/Tailwind drops absolute @import URLs at build time */}
        <link
          rel="stylesheet"
          href="/slds/styles/salesforce-lightning-design-system.min.css"
        />
        {/* Live SF Lightning (SLDS 2) renders with the SYSTEM font stack, not
            Salesforce Sans. Measured from the org: -apple-system, "system-ui",
            "Segoe UI", Roboto, Helvetica, Arial. globals.css sets the same. */}
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
