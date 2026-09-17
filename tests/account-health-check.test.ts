import { describe, expect, it } from 'vitest';
import { accountHealthResults, welcomeCallHealthWhere } from '../src/lib/account-health-check';

describe('Salesforce account health parity', () => {
  it('requires a completed account task containing the Salesforce subject', () => {
    expect(welcomeCallHealthWhere('account-1')).toEqual({ accountId: 'account-1', status: 'COMPLETED', subject: { contains: 'Welcome Call Completed', mode: 'insensitive' } });
  });
  it.each([null, undefined, '', '  ', false])('does not treat an absent payment date (%s) as received', date => {
    expect(accountHealthResults(1, date).map(x => x.label)).toEqual(['First Payment Not Received', 'Welcome Call completed']);
  });
  it('matches the Salesforce all-pass messages', () => {
    expect(accountHealthResults(1, '2026-09-17').map(x => x.label)).toEqual(['Welcome Call completed', 'First Payment Received']);
  });
  it('preserves check order for equal severity and uses the worst status for summary', () => {
    const results = accountHealthResults(0, null);
    expect(results.map(x => x.id)).toEqual(['welcome-call', 'first-payment']);
    expect(results.every(x => x.ok)).toBe(false);
  });
  it('keeps a missing welcome task ahead of a successful payment', () => {
    expect(accountHealthResults(0, '2026-09-17').map(x => x.ok)).toEqual([false, true]);
  });
});
