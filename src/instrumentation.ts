/**
 * Next.js startup hook. Runs once when the server boots (nodejs runtime only).
 * Starts the always-on Five9 Supervisor feed so the CRM can screen-pop the
 * matching lead for whichever agent is on a call.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { supervisorFeed } = await import("@/lib/five9/supervisor-feed");
    supervisorFeed.start();

    // Nightly Salesforce -> CRM data sync (runs in this container; requires
    // the SF_AUTH_URL env var - see src/lib/sf-sync/runner.ts).
    const { scheduleNightlySfSync } = await import("@/lib/sf-sync/runner");
    scheduleNightlySfSync();
  }
}
