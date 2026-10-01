import { EmbeddedSender } from "@/components/esign/embedded-sender";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EmbeddedSender id={(await params).id} />;
}
