/** Port of Salesforce HealthCheckerLead.cls; messages intentionally retain SF wording. */
export interface LeadHealthCheckInput {
  status: string;
  businessName: string | null;
  firstName: string | null;
  lastName: string | null;
  industry: string | null;
  totalDebt: number | null;
  debts?: readonly { amount: number }[];
  leadSource: string | null;
  isPaymentAmountPopulated: boolean;
  firstCreditorDebt: number | null;
  callDispositionPopulated: boolean;
}

export function leadHealthResults(i: LeadHealthCheckInput) {
  // Apex string equality is case insensitive; also supports native CRM NEW.
  if (!['new', 'working lead'].includes(i.status.toLowerCase())) return [];
  const totalDebt = i.debts ? i.debts.reduce((sum, debt) => sum + debt.amount, 0) : (i.totalDebt ?? 0);
  const hasDebtDetails = i.debts ? i.debts.some((debt) => debt.amount > 0) : (i.firstCreditorDebt ?? 0) > 0;
  const check = (id: string, ok: boolean, success: string, error: string) => ({ id, ok, label: ok ? success : error });
  return [
    check('company', !!i.businessName, 'Company Name is populated', 'Company Name is Not Populated'),
    check('name', !!i.firstName && !!i.lastName, 'First Name Or Last Name is Populated', 'First Name Or Last Name is Not Populated'),
    check('call-disposition', i.callDispositionPopulated, 'Call Disposition is Populated', 'Call Diposition is Not Populated'),
    check('debt-details', hasDebtDetails, 'Debt Details are Populated', 'Debt Details are Not Populated'),
    check('minimum-debt', totalDebt >= 30000, 'Minimum Total Debt requirement is met', 'Minimum Total Debt requirement is Not met'),
    check('industry', !!i.industry, 'Industry is populated', 'Industry is not populated'),
    check('payment', i.isPaymentAmountPopulated, 'Payment Amount Populated', 'Payment Amount is Not Populated'),
    check('inbound-name', i.lastName?.toLowerCase() !== 'new inbound', 'Last Name should not be  New Inbound', 'Last Name should not be  New Inbound'),
    check('source', !!i.leadSource?.trim(), 'Lead Source is populated.', 'Lead Source should be populated.'),
  ].sort((a, b) => Number(a.ok) - Number(b.ok));
}
