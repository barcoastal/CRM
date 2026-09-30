import { PacketWizard } from "@/components/esign/packet-wizard";
export default async function Packet({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PacketWizard packetId={id} />;
}
