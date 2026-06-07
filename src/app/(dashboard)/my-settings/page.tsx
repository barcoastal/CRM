import { redirect } from "next/navigation";

export default function MySettingsIndex() {
  redirect("/my-settings/personal-information");
}
