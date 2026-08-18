// src/app/(dashboard)/email-center/flows/new/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewFlowClient } from "./new-flow-client";

export const dynamic = "force-dynamic";

export default async function NewEmailFlowPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <NewFlowClient />;
}
