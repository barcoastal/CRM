# Call-center verification — 2026-09-24

The feature is implemented in the existing CRM repository, on branch `feat/native-call-center-20260924`. `/call-center` is a dashboard route using the existing authenticated layout. The native phone provider mounts around the existing CRM shell when enabled, and the existing CallButton routes to that provider. This is not a separate application.

The local screen previews are `http://127.0.0.1:3088/opener.html`, `http://127.0.0.1:3088/closer.html`, and `http://127.0.0.1:3088/live-floor.html`; `preview.html` opens the opener desk. Each renders a separate role-specific sample session. It renders the production role screen components and PhonePanel within the production SldsShell/ConsoleNav. The sample workflow is shared across these pages through localStorage, so manager approval and closer readiness update the opener screen. Only preview data, session, and navigation are stubbed; the preview cannot place calls or write CRM records. Its highlighted sample data is not a report of production activity.

Verification:

- 175 tests pass across call-center security, call ownership/transitions, webhook handling, priority dispatch, parallel-call pacing/handoff, migration/atomic claims, existing permissions, and the existing Floor Manager tier boundary cases. New page-access tests cover opener/closer separation, direct unauthorized URL redirects, inactive users, permission revocation, and current database permissions replacing stale session privileges. Role workflow tests cover individual lender persistence, exact currency totals, Salesforce provenance, manager scope, stale requests, wrong-tier rejection, selected-closer notification, atomic closer reservations, cancellation, three-way connection without holding the client, handoff completion, opener audio reuse, and roster privacy.
- All four SQL migrations execute in PGlite (embedded PostgreSQL) and preserve existing Call records. Duplicate provider call IDs and web-lead jobs are rejected; concurrent agent/dispatch claims have one winner. Agent audio legs can be reused in sequential call-history records.
- Targeted ESLint passes.
- The full Next.js webpack production build passes with an 8 GB Node heap. The first full build compiled but its TypeScript worker exceeded Node's default 4 GB heap; use `NODE_OPTIONS=--max-old-space-size=8192 npx next build --webpack` for this checkout.
- Browser-verified the actual CRM shell, all three separate role pages without switching tabs, the shared request → manager approval → closer readiness → three-way introduction → opener exit sequence, including the closer retaining the client, the closer Open/Closed control, and the live-floor on-call filter. Previously verified the shared web-priority-team dialog, cold-campaign selection, and team-wide line limits of 10 and 20. Earlier core workspace checks covered live activity, campaign scripts, queue settings, phone keypad, disabled preview calling, and a 390px layout.
- No live calls or production database/number-routing changes were made. Carrier audio, ringing, transfers, monitoring privacy, and recordings require the Twilio pilot described in `docs/native-call-center.md`.

The outbound extension implements the user's confirmed choices: a shared priority team for new web leads, and parallel cold calls across the whole team. The first-call target is measured from CRM lead creation to the earliest signed provider initiation/ringing timestamp, including out-of-order callbacks. It remains a target dependent on staffing, calling hours, and carrier readiness. The preview's counters are static fixtures; no claims about live call-center activity are implied.

Rebuild preview after a Next build:

```sh
node validation/call-center/build-preview.mjs
python3 -m http.server 3088 --bind 127.0.0.1 --directory validation/call-center
```

The generated JS/CSS, copied CRM CSS, local asset symlinks, and verification logs are ignored; they are local artifacts. The preview server binds only to loopback.

The opener has no left navigation rail, metric cards, or recent-call table. It shows source and brand, editable lender/debt rows with a calculated total, notes, a matching-tier availability roster, and approval progress. Qualification locks during an active handoff request. The manager selects the closer, the closer marks open for that request, and only then can the opener connect the introduction. CRM banners and sound support each stage. The preview's Reset sample button restarts the shared workflow. Its alert links preserve the handoff section anchors.

Browser checks cover all three linked role screens through completed handoff, with the opener waiting for the next lead and the closer still viewing the same client. Adding and saving a lender, precise totals including cents, locking edits during approval, canceling a request, and alert section links were also checked. Sound unlock and the visible alerts were checked; actual carrier audio remains part of the staging pilot. Production page guards live in `src/lib/call-center/page-access.ts`; visual previews use labeled fixtures and do not authenticate real agents. The approval change requires the fourth additive migration, `prisma/sql/native-call-center-approval.sql`.
