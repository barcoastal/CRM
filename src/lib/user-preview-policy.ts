/** Reads keep real permissions intact; mutations are blocked in preview. */
export function previewBlocksRequest(method: string, pathname: string): boolean {
  if (pathname === "/api/admin/user-preview" || pathname === "/api/auth/signout") return false;
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  // OAuth callbacks and legacy GET endpoints can change state or issue tokens.
  return /^\/api\/(cron|inbound|flow\/poll|cadences\/run|engagement\/process|admin\/import-docusign|sms\/(booking-reminders|send-queue)|emails\/(send-queue|track)|integrations\/google-calendar\/(connect|callback)|dialer\/five9\/(agent\/(session|credentials)|push-leads|dnc-sync|test-connection))(\/|$)/.test(pathname);
}
