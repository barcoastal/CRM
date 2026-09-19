/** Exact LeadTriggerHandler.validateCreditorPayments rule, verified 2026-09-18.
 * The source checkbox is hidden from the integration profile; derive it from
 * the same creditor fields rather than treating an unreadable flag as false.
 * Null payments pass in the source; zero/negative payments fail when debt is non-null.
 */
export function leadPaymentPopulated(fields: Record<string, unknown>): boolean {
  for (let i = 1; i <= 10; i++) {
    const debt = fields[`Creditor_${i}_Total_Debt__c`];
    const payment = fields[`Creditor_${i}_Payment__c`];
    if (debt !== null && debt !== undefined && debt !== '' &&
        payment !== null && payment !== undefined && payment !== '' &&
        Number.isFinite(Number(payment)) && Number(payment) <= 0) return false;
  }
  return true;
}
