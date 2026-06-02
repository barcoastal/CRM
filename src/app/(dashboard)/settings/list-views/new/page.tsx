import { ListViewForm } from "@/components/settings/list-view-form";

interface NewListViewPageProps {
  searchParams: Promise<{ entity?: string; returnTo?: string }>;
}

export default async function NewListViewPage({ searchParams }: NewListViewPageProps) {
  const params = await searchParams;
  const entity = params.entity ?? "Lead";
  return <ListViewForm entity={entity} returnTo={params.returnTo} />;
}
