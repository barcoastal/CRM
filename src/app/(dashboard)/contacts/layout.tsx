import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";

export default async function ContactsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !hasPermission(session.user.permissions ?? [], "Contact.View")) notFound();
  return children;
}
