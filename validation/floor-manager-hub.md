# Floor Manager Hub — 2026-09-23

Consolidates Meetings, Floor Manager, Closer Dashboard and Closers On Call into a single navigation item at `/floor-manager`. Five sections share a persistent header: Live Floor, Meetings, Closer Dashboard, Closers On Call and Closer Setup. Old links redirect to the corresponding section; saved navigation order maps the former four items to one hub.

Closer Setup adds existing active CRM users to the closer roster, assigns Tier 1/2/3, and displays the client debt each closer handles. Tier 1 remains the most senior tier for the largest clients. The existing configured boundaries are loaded from the database (defaults only when no config exists: Tier 3 below $100,000; Tier 2 from $100,000 to under $250,000; Tier 1 at or above $250,000). These are editable shared tier boundaries, not production or sales quotas.

Saves use the existing `/api/closer-tiers` endpoint and preserve `Setup.Admin` authorization. Other signed-in users can view the active closer roster and eligibility without editing it. Only changed roster entries are submitted. Limits and assignments save in one transaction. Explicit roster removal clears both the tier and closer status. No schema changes, database migrations, live roster edits, or outgoing messages were performed.

## Validation

- 26 focused Vitest tests passed: exact routing boundaries, invalid ranges, duplicate assignments, permissions, atomic configuration and roster saves, active-user restriction, removal semantics and compatibility with older API clients.
- Standalone TypeScript check passed.
- Production webpack build passed; existing fonts required network access for the first build.
- ESLint passed for the new hub files, closer setup component, shared validator, API route and new tests.
- The pre-existing header and edit-navigation modal still produce their original `react-hooks/set-state-in-effect` lint errors; the header also has its pre-existing unused `ObjectIcon` warning. Confirmed against HEAD via ESLint stdin. No additional diagnostics were introduced there.
- Browser verification used the real UI components with a local sample-data adapter: five-section navigation, add a closer, change an existing closer's tier, update debt limits, save changed entries, reject invalid thresholds, discard edits and read-only mode. This is UI verification, not a production database save test.
- `git diff --check` passed.

Local review: `http://127.0.0.1:3096/floor-manager/closers` (sample data; local preview server required).

The changes are prepared in `feat/floor-manager-hub-20260923`, based on `origin/main` at `6b30bd85`. Publication uses the existing GitHub main → Railway deployment flow. Live navigation is verified after the deployment succeeds.
