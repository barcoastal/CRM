import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MonthlyScoreboard } from "@/components/scoreboard/monthly-scoreboard";

export const dynamic = "force-dynamic";
export default async function ScoreboardTvPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.mustResetPassword) redirect("/reset-password");
  return <MonthlyScoreboard tv />;
}
