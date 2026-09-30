import { TemplateShell } from "@/components/esign/center/template-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TemplateShell library="pdf">{children}</TemplateShell>;
}
