import { redirect } from "next/navigation";
export default function Page() {
  redirect("/sign-docs?tab=templates");
}
