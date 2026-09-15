import { notFound, redirect } from "next/navigation";
import { analyticsAccess, AnalyticsAccessError } from "@/lib/analytics-access";

export async function analyticsPageAccess(required: string) {
  try { return await analyticsAccess(required); }
  catch (error) {
    if (error instanceof AnalyticsAccessError) {
      if (error.status === 401) redirect("/login");
      notFound();
    }
    throw error;
  }
}
