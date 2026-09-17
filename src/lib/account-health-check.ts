// Mirrors HealthCheckerAccount, TaskData and HealthCheckController in the SF export.
export function welcomeCallHealthWhere(accountId: string) {
  return { accountId, status: 'COMPLETED' as const, subject: { contains: 'Welcome Call Completed', mode: 'insensitive' as const } };
}

export function accountHealthResults(completedWelcomeCalls: number, firstPaymentCompletedDate: unknown) {
  const welcome = completedWelcomeCalls > 0;
  const payment = typeof firstPaymentCompletedDate === 'string' && firstPaymentCompletedDate.trim().length > 0;
  return [
    { id: 'welcome-call', label: welcome ? 'Welcome Call completed' : 'Welcome Call Not completed', ok: welcome },
    { id: 'first-payment', label: payment ? 'First Payment Received' : 'First Payment Not Received', ok: payment },
  ].sort((a, b) => Number(a.ok) - Number(b.ok));
}
