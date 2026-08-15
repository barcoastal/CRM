import type { ReactNode } from "react";
import { Instrument_Sans } from "next/font/google";
import { TabRail } from "./tab-rail";
import "./email-center.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function EmailCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`ec-root ${instrument.className}`}>
      <TabRail />
      <main style={{ flex: 1, minWidth: 0, display: "flex", overflow: "hidden" }}>{children}</main>
    </div>
  );
}
