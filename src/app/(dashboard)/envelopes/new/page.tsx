import { PacketWizard } from "@/components/esign/packet-wizard";
export default async function NewPacket({
  searchParams,
}: {
  searchParams: Promise<{
    opportunityId?: string;
    name?: string;
    email?: string;
  }>;
}) {
  const p = await searchParams;
  return (
    <PacketWizard
      opportunityId={p.opportunityId}
      defaultName={p.name}
      defaultEmail={p.email}
    />
  );
}
