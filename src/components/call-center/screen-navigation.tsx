import Link from "next/link";
import { CALL_CENTER_PATHS, type CallCenterScreen } from "@/lib/call-center/access";

const screens: { screen: CallCenterScreen; label: string }[] = [
  { screen: "opener", label: "Opener" },
  { screen: "closer", label: "Closer" },
  { screen: "floor", label: "Live Floor" },
  { screen: "operations", label: "Campaigns & Queues" },
];

export function CallCenterScreenNavigation({ screen, access }: {
  screen: CallCenterScreen;
  access?: Record<CallCenterScreen, boolean>;
}) {
  if (!access?.opener || !access.closer) return null;
  return (
    <nav className="cc-screen-navigation" aria-label="Call Center screens">
      {screens.filter(item => access[item.screen]).map(item => (
        <Link key={item.screen} href={CALL_CENTER_PATHS[item.screen]}
          aria-current={screen === item.screen ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
