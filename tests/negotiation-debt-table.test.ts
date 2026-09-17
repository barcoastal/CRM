import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/use-lenders", () => ({ useLenders: () => ({ lenders: [] }), matchLender: () => null }));
import { OppDebtInformation } from "@/components/opportunities/opp-debt-information";
const items = [{ id: "debt", creditorName: "OnDeck", debtType: "MCA", originalBalance: 45000, currentBalance: 41000, enrolledBalance: 41000, paymentAmount: 100, paymentFrequency: "DAILY", status: "ENROLLED", paymentStatus: "Default" }];
it("uses the opportunity debt fields and lender expansion in the negotiation selector", () => {
 const html = renderToStaticMarkup(createElement(OppDebtInformation, { opportunityId: "opp", items, readOnly: true, selectedDebtId: "debt", onSelectDebt: () => {} }));
 expect(html).toContain("Merchant Cash Advance"); expect(html).toContain("45,000.00"); expect(html).toContain("500.00"); expect(html).toContain("Default"); expect(html).toContain("Collapse lender info"); expect(html).toContain("Selected");
 expect(html).not.toContain("+ Add Debt"); expect(html).not.toContain('title="Delete"'); expect(html).not.toContain('title="Edit"'); expect(html).not.toContain('aria-label="Frequency');
});
it("preserves opportunity editing controls", () => {
 const html = renderToStaticMarkup(createElement(OppDebtInformation, { opportunityId: "opp", items }));
 expect(html).toContain("+ Add Debt"); expect(html).toContain('title="Edit"'); expect(html).toContain('title="Delete"'); expect(html).toContain('aria-label="Frequency for OnDeck"');
});
