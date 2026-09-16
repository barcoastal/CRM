/** Monetary calculations use cents so installments always sum to the offer. */
export function calculateOffer(balance: number, amount: number, payments: number) {
  if (!Number.isFinite(balance) || balance <= 0 || !Number.isFinite(amount) || amount <= 0 || amount > balance || !Number.isInteger(payments) || payments < 1 || payments > 360) return null;
  const cents = Math.round(amount * 100);
  if (cents < payments) return null;
  const regular = Math.floor(cents / payments);
  return { amount: cents / 100, percent: amount / balance * 100, savings: Math.round((balance - cents / 100) * 100) / 100, payment: regular / 100, finalPayment: (cents - regular * (payments - 1)) / 100 };
}
