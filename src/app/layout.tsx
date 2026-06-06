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
        {/* Salesforce Sans — the actual SF Lightning font, served from SF's CDN */}
        <link rel="preconnect" href="https://style.salesforce-experience.com" crossOrigin="" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
@font-face {
  font-family: "Salesforce Sans";
  src: url("https://style.salesforce-experience.com/fonts/SalesforceSans-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Salesforce Sans";
  src: url("https://style.salesforce-experience.com/fonts/SalesforceSans-Italic.woff2") format("woff2");
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: "Salesforce Sans";
  src: url("https://style.salesforce-experience.com/fonts/SalesforceSans-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Salesforce Sans";
  src: url("https://style.salesforce-experience.com/fonts/SalesforceSans-Light.woff2") format("woff2");
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}
.sf-record-page, .sf-record-page * {
  font-family: "Salesforce Sans", "Helvetica Neue", system-ui, -apple-system, sans-serif;
}
`,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
