# Monthly closer scoreboard and TV

- Hub route: `/floor-manager/scoreboard`; legacy `/scoreboard` redirects here.
- Dedicated authenticated TV route: `/scoreboard/tv`, outside the CRM shell.
- Monthly gross/net debt, transfers, signed contracts, Closed Won, first-payment production, individual goals, and weighted team goal progress. Full metrics and definitions available in the hub.
- Goals are stored by closer and Eastern calendar month; editing requires `Setup.Admin`. Routing tiers and debt eligibility are unchanged.
- TV refreshes every eight seconds, paginates to available screen height, and rotates pages every 20 seconds.
- New recorded transitions into `Closed Won*` queue an eight-second touchdown with the closer's name and debt. Won-to-won substage changes do not celebrate. A fresh TV tab starts from now; the tab's cursor and seen IDs survive reload. Short poll overlap catches committing transactions; timestamp/ID pagination preserves simultaneous wins. Reconnection catch-up is bounded to one hour.
- Optional synthesized fanfare requires an explicit sound-toggle click. Sound defaults off. Test touchdown never writes a deal. Reduced-motion settings suppress moving effects.

## Data definitions and limits

Monthly production uses first-contract-signing date, recorded signing/won history, close date, then creation date. Current assigned closer receives attribution. Gross includes signed deals subsequently canceled; net subtracts signed deals currently canceled, lost, or archived. Won and first paid are current statuses within the signed-month cohort. Transfers use creation month; contracts out are those transfers currently in Contract Sent. These are explained in the UI.

Celebrations consume CRM OpportunityHistory stage events. Historical Salesforce bulk imports do not create live-win events. No client names or contact details are shown on the TV.

## Schema

Additive only: `CloserScoreboardTarget` with user/month uniqueness and period index; a `changedAt` index on OpportunityHistory. No dropped columns, backfill, or seeded performance goals.

## Validation

- Prisma generate and schema validation passed.
- 57 targeted tests passed (monthly boundaries including DST/year rollover, target math, roster totals, event baseline, overlap deduplication, simultaneous cursor pagination, auth, goal validation/atomic writes, and existing closer setup regressions).
- TypeScript and focused ESLint passed.
- Production webpack build passed with an 8 GB Node heap. A first build hit the default local 4 GB heap during type checking; compilation itself succeeded.
- Browser tested actual React components against isolated sample responses: 1920×1080 fits all 12 closers and totals with no table scroll; touchdown visual with name/debt/confetti; sound toggle; two polled wins celebrate in order; reload does not replay; changed monthly goal saves and updates progress.
- No real deal was edited for QA. Preview harness is local and excluded from the release.
