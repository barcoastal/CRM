import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["status", "source", "templateId", "sent", "q", "page"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  redirect(`/sign-docs?${query}`);
}
