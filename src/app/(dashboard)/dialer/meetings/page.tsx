import { redirect } from "next/navigation";

export default function LegacyFloorPage() {
  redirect("/floor-manager/meetings");
}
