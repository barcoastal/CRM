import { requireAuth } from "@/lib/api-auth";
import { NewCaseForm } from "@/components/cases/new-case-form";

export default async function NewCasePage() {
  await requireAuth("Case.Create");
  return <NewCaseForm />;
}
