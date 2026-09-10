import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WarRoomClient } from "@/components/war-room/war-room-client";

export const dynamic = "force-dynamic";

/**
 * Flow Reply War Room — a shared team queue of all inbound email + SMS with
 * inline reply. Not per-user scoped (it's a war room).
 */
export default async function WarRoomPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <div style={{ padding: "16px 20px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#181818" }}>Flow Reply War Room</h1>
      <p style={{ fontSize: 13, color: "#747474", margin: "0 0 14px" }}>All inbound email and SMS in one place — reply live.</p>
      <WarRoomClient />
    </div>
  );
}
