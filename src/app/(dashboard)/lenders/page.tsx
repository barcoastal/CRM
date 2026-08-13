import { LendersDirectory } from "@/components/debts/lenders-directory";

export const metadata = { title: "Lenders | Coastal CRM" };

/**
 * The lender intel sheet as a browsable page: every lender we track with
 * risk level, COJ/TRO, venue and the agent notes. Same dataset that powers
 * the card next to the creditor picker.
 */
export default function LendersPage() {
  return <LendersDirectory />;
}
