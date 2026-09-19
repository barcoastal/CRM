import { describe, expect, it } from 'vitest';
import { leadHealthResults, type LeadHealthCheckInput } from '../src/lib/lead-health-check';
const passing: LeadHealthCheckInput = { status: 'New', businessName: 'Example', firstName: 'Jane', lastName: 'Smith', industry: 'Trucking', totalDebt: 30000, leadSource: 'Google', isPaymentAmountPopulated: true, firstCreditorDebt: 30000, callDispositionPopulated: true };
const check = (overrides: Partial<LeadHealthCheckInput>, id: string) => leadHealthResults({ ...passing, ...overrides }).find(x => x.id === id)!;
describe('Salesforce lead health checks', () => {
  it.each(['New', 'Working Lead', 'NEW'])('runs all nine checks for %s', status => {
    const results = leadHealthResults({ ...passing, status });
    expect(results).toHaveLength(9);
    expect(results.every(x => x.ok)).toBe(true);
  });
  it.each(['Converted', 'Archive Disposition', 'Closed', 'Contacted'])('does not run for %s', status => {
    expect(leadHealthResults({ ...passing, status })).toEqual([]);
  });
  it.each([{ firstName: null }, { lastName: null }])('requires both names: %j', names => {
    expect(check(names, 'name')).toMatchObject({ ok: false, label: 'First Name Or Last Name is Not Populated' });
  });
  it('does not allow an estimated total to substitute for first-creditor debt', () => {
    expect(check({ firstCreditorDebt: 0, totalDebt: 100000 }, 'debt-details').ok).toBe(false);
  });
  it('uses the inclusive $30,000 threshold', () => {
    expect(check({ totalDebt: 29999.99 }, 'minimum-debt').ok).toBe(false);
    expect(check({ totalDebt: 30000 }, 'minimum-debt').ok).toBe(true);
  });
  it('matches the placeholder surname exactly, case insensitive like Apex', () => {
    expect(check({ lastName: 'new inbound' }, 'inbound-name').ok).toBe(false);
    expect(check({ lastName: 'Smith New Inbound' }, 'inbound-name').ok).toBe(true);
  });
  it('uses failure wording and places failed checks first', () => {
    const results = leadHealthResults({ ...passing, callDispositionPopulated: false, isPaymentAmountPopulated: false, leadSource: ' ' });
    expect(results.slice(0, 3).map(x => x.label)).toEqual(['Call Diposition is Not Populated', 'Payment Amount is Not Populated', 'Lead Source should be populated.']);
    expect(results.slice(3).every(x => x.ok)).toBe(true);
  });
});

import { leadPaymentPopulated } from '../src/lib/lead-payment-health';
describe('source creditor payment health rule',()=>{
 it('preserves null semantics instead of turning missing payments into zero',()=>{
  expect(leadPaymentPopulated({Creditor_1_Total_Debt__c:30000,Creditor_1_Payment__c:null})).toBe(true);
  expect(leadPaymentPopulated({Creditor_1_Total_Debt__c:'30000',Creditor_1_Payment__c:''})).toBe(true);
 });
 it('rejects zero or negative payment for any non-null debt, including zero debt',()=>{
  expect(leadPaymentPopulated({Creditor_1_Total_Debt__c:0,Creditor_1_Payment__c:0})).toBe(false);
  expect(leadPaymentPopulated({Creditor_10_Total_Debt__c:30000,Creditor_10_Payment__c:-1})).toBe(false);
  expect(leadPaymentPopulated({Creditor_1_Total_Debt__c:null,Creditor_1_Payment__c:0})).toBe(true);
 });
});
