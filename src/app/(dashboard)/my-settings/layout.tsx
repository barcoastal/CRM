import { SettingsTree } from "./settings-tree";
import "./my-settings.css";

export default function MySettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ms-shell">
      <SettingsTree />
      <div className="ms-main">{children}</div>
    </div>
  );
}
