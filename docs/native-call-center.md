# Native CRM call center

The `/call-center` entry sends each user to their assigned screen and provides human-agent browser calling using Twilio Programmable Voice. Source lives in `src/lib/call-center`, `src/components/call-center`, and `src/app/api/call-center`. This implementation is staged locally; no production database, carrier account, phone number, or Five9 setting has been changed.

## Implemented workflows

- Persistent WebRTC phone across CRM navigation; click-to-call from existing lead/account/opportunity buttons, keypad, mute, call timer, and hangup.
- Per-number inbound queues with assigned agents, configurable greeting and maximum wait. Available connected agents claim waiting callers in arrival order on their heartbeat (at most 15 seconds before an idle agent attempts a claim). A missed ring requeues the customer and pauses that agent. An unanswered queue expires after its configured wait, checked every 15 seconds.
- Two automatic outbound workflows inside the CRM: a shared web-lead priority team with a 60-second first-attempt target, and cold-list parallel dialing with a configurable team-wide limit (10 by default, up to 100). Existing one-at-a-time calling remains available.
- Existing CRM outbound campaigns with assigned agents, campaign/state calling windows, shared DNC suppression, three attempts maximum, and a 30-minute retry cooldown. Callbacks require a future date and become eligible at that time.
- Qualified sales handoffs require Floor Manager approval, then readiness from the selected closer. The opener connects the closer to the existing client call for a three-way introduction and leaves when ready. Generic transfers outside the qualified sales workflow retain private consultation. Transfer and supervisor actions are logged in VoiceEvent.
- Supervisor live view and listen, whisper (only the selected agent hears the supervisor), or join (all parties hear the supervisor).
- Outcomes, notes, and optional recordings integrated into existing Call records. DNC outcomes persist to both the lead and the shared suppression list.
- Signed Twilio webhooks, short-lived browser tokens, current user/permission checks, single-call agent reservations in PostgreSQL, idempotent customer creation, and background reconciliation of unfinished calls.

## Opener, closer, and live floor

The call center has separate pages inside the existing CRM shell, each protected on the server. `/call-center` resolves the user's current account, Floor Manager closer assignment, and effective permissions before redirecting to the correct page.

| Page | Access |
|---|---|
| `/call-center/opener` | Active callers without a closer flag/tier, or supervisors explicitly granted `CallCenter.ViewAllDesks` |
| `/call-center/closer` | Active callers assigned as closers in Floor Manager, or supervisors explicitly granted `CallCenter.ViewAllDesks` |
| `/call-center/live-floor` | Admins or explicit `CallCenter.Supervise` / `Modify.AllData` access, with calling permission |
| `/call-center/manage` | The same supervisor access |

Every page rechecks current database permissions and role assignments; old session admin claims cannot grant screen access. Direct unauthorized page URLs redirect to the person's own permitted home. The CRM navigation uses that same access result. Supervisors retain their own opener or closer calling desk according to their Floor Manager role, and can navigate to it separately. Existing APIs continue to enforce call ownership, closer qualification/availability, and supervisor team scope.

Assign `CallCenter.ViewAllDesks` through a permission set to an individual supervisor who needs to inspect both desks. It requires existing calling and supervision access and is checked explicitly rather than inferred from an admin role. Authorized users receive a screen switcher on all four pages. Their actual calling role, tier, queue eligibility, and call-action permissions remain governed by the existing rules. Removing the grant restores the normal desk restrictions on the next permission check.

The opener desk is a focused calling workspace with no left navigation rail or dashboard panels: current lead, call controls, lender-by-lender qualification, and transfer progress. It shows the imported lead source and brand, each lender and debt amount, a calculated total, and notes for the closer. The matching tier roster is read-only; the Floor Manager selects the receiving closer. The visual design uses the existing Inter typeface, a neutral canvas, a dark call-control bar, and soft input fields. The closer desk shows approved requests, availability controls, a client qualification brief, handoff timeline, and personal handoff history. The live floor has pending approvals, search and role/status filters, live call monitoring, closer coverage by debt tier, priority lead watch, and campaign capacity. Counts labeled recent reflect the bounded records loaded by the API; they are not lifetime totals.

Lead provenance comes from existing CRM Salesforce imports: the imported Salesforce LeadSource is preferred when present, with the CRM source as fallback; brand uses the CRM field or imported Brand__c. Raw Salesforce snapshots are not returned to the browser. This change does not establish a new Salesforce connection or write qualification back to Salesforce. Saving qualification updates the CRM LeadDebt rows and the call's immutable-during-approval qualification snapshot. Each row requires a lender name and positive debt amount; the total and lender count are calculated. Existing payment metadata is preserved when updating a lender.

When native mode is enabled, `/floor-manager` performs the same supervisor check and redirects to the live-floor page. The existing closer roster and debt limits continue to be managed at `/floor-manager/closers`.

- **Opener:** connect the CRM phone and click **Start dialing**. During a connected lead call, enter each lender and debt amount, add notes, and save qualification. **Request transfer approval** alerts authorized Floor Managers in scope. Qualification is locked while approval or connection is pending; cancel the request before changing it. The client remains with the opener throughout approval and closer readiness.
- **Floor Manager:** review the source, brand, lender breakdown, debt total, and notes. Choose a closer from the matching configured debt tier, then **Approve & ping closer**, or decline with a reason. Approval alerts only that selected closer. It does not connect or transfer the client.
- **Closer:** after approval, **Mark open & notify opener** reserves the closer for that client. This requires an active, connected, idle closer in the correct tier and prevents two openers from reserving the same seat. The opener then sees **Connect closer**. The receiving browser accepts only the specific approved transfer leg, matched by provider call ID. Closing availability withdraws an unconnected reservation; it never ends a current conversation. Open closers become available after saving the call outcome; closed closers remain paused.
- **Live floor:** shows opener/closer roles, current availability, clients and debt where authorized, call durations, and recent qualified handoffs. Monitoring and approvals follow supervisor team permissions. Other agents can see colleague availability but cannot obtain foreign call IDs or client details through the shared roster.

Pings are CRM alerts with sound. Each transition also creates a persistent CRM notification. The open CRM session displays a handoff banner and plays a short tone after the browser's audio permission has been unlocked by interaction; **Enable alert sound** is shown when needed. Alerts are keyed to the request and stage to avoid replaying on every poll.

Debt routing and roster assignments reuse `CloserTierConfig` and the User closer flags saved at **Floor Manager → Closers** (`/floor-manager/closers`). There is no second set of limits. Debt below the smaller cutoff goes to Tier 3; debt at or above the smaller cutoff and below the larger cutoff goes to Tier 2; debt at or above the larger cutoff goes to Tier 1. The existing defaults remain the fallback if no config has been saved. The new migration does not change current tier values or assignments.

**Connect closer** adds the approved closer to the existing conversation with the client and opener; the client is not held for a private consultation. **Leave call & next lead** becomes available only after the closer has actually joined. It records the Floor Manager as the handoff assigner, assigns the lead and live call to the closer, then removes the opener's audio leg. The client and closer remain connected. The opener's automatic audio leg returns to standby for the next web/cold call; manual callers return to phone controls. **Cancel handoff** removes the receiving leg and restores qualification without creating a handoff record. A failed connection returns to closer readiness. Carrier connectivity is required for joining, leaving, and resuming standby.

An `ENROLLED` call outcome closes the linked handoff; `NOT_INTERESTED`, `NOT_QUALIFIED`, and `DNC` mark that handoff lost. This updates the handoff record, not an Opportunity or financial ledger.

## Automatic outbound workflows

The confirmed routing is **one shared web-lead priority team** and **one cold-campaign line limit across the whole team**, not a per-agent multiplier.

**Web leads:** an administrator selects the priority team and enables the workflow in Call Center. Every second, a durable worker picks up newly created `WEB` / `NEW` leads after the enable timestamp. It covers the existing marketing and lead-import paths through their CRM records, with one durable job per lead. Historical imports must preserve their original `createdAt`; do not insert an old list as newly created WEB records. The oldest eligible job gets the next ready agent, becomes assigned to that agent, and starts dialing after the agent audio joins. The 60 seconds run from CRM creation to the signed provider's initiation/ringing callback, not from a queue claim. The phone must be valid, unsuppressed, and within calling hours. No available agent means the lead stays pending and becomes visibly overdue; the system cannot guarantee a one-minute call without available staffing and working carrier service. Blocked calling windows/callbacks are retried for eligibility once a minute. Failed agent setup before any customer dial returns the lead to the priority queue; an uncertain carrier attempt is never automatically repeated.

**Cold lists:** assign `LIST` or `BUSINESS` leads to campaign agents, add them to an active non-AI CRM campaign, then start it from Parallel power dialing. Openers click **Start dialing** in the Opener view to open their audio seat and set availability. Users marked as closers or assigned a closer tier are excluded from automatic web/cold agent claims. The worker fills the team-wide line limit using the configured account Calls Per Second. It reduces pacing as the observed pickup rate increases, counts active attempts before creating more, and stops launches when no eligible audio seats remain. Eligible web leads and waiting inbound callers take capacity before fresh cold calls. Existing conversations are never interrupted for a new web lead. Cold dialing uses synchronous Twilio answering-machine detection; machines/faxes are ended without taking an agent, while `unknown` is treated as a possible human. Detection is imperfect and adds latency, which must be measured in the pilot.

Live answers atomically claim an already-connected agent audio leg. The customer enters the conference only after that agent joins; the handoff checks again after one second and stops waiting after two seconds from the detection result. A missed handoff gets a company-identification/callback message and is logged; it also pauses the campaign. Delayed bridges exceeding two seconds from the answer callback are conservatively flagged even if they eventually connect. A campaign with a missed-connection rate at or above 2% of detected/unknown human answers over the preceding 30 days cannot be restarted through the parallel-dialing button. This is an operational stop, **not a legal safe-harbor certification**; the timing starts at the provider answer event, not measured completion of the person's greeting. Validate the applicable campaign rules and message wording before the pilot.

After the customer disconnects, the agent stays in wrap-up until saving an outcome. Their audio leg returns to standby, and saving makes them available for the next automatic call. Pausing a campaign stops new attempts and lets active calls finish. Manual click-to-call requires leaving automatic dialing first. Calls that reach an agent link to the existing Call/Lead records. Unanswered, machine, and overflow attempts stay in VoiceCall and the native call history, since the existing Call model requires a real assigned agent.

## One-time Twilio setup

Use a staging CRM deployment and a test number first. Set these environment variables in that deployment's secret settings, never in a browser/public variable or source control:

| Variable | Value |
|---|---|
| `CRM_DIALER_MODE` | `twilio` on the pilot deployment; `five9` otherwise |
| `TWILIO_ACCOUNT_SID` | Account SID (`AC...`) |
| `TWILIO_AUTH_TOKEN` | Account auth token, for validating webhook signatures |
| `TWILIO_API_KEY` | API key SID (`SK...`) for that account |
| `TWILIO_API_SECRET` | Its API key secret |
| `TWILIO_TWIML_APP_SID` | Voice TwiML application SID (`AP...`) |
| `TWILIO_OUTBOUND_NUMBER` | Voice-enabled, company-owned US/Canada number in `+1...` form |
| `CALL_CENTER_PUBLIC_URL` | Exact public HTTPS origin, without a path (e.g. `https://crm.example.com`) |
| `CALL_CENTER_RECORD_CALLS` | `false` by default; opt in only after setting your recording policy |
| `CALL_CENTER_CALLS_PER_SECOND` | The account's approved CPS; defaults to 1, supported range 1–5. This is launch rate, separate from simultaneous line count. |
| `CALL_CENTER_COMPANY_NAME` | Company identity used if a cold-call answer cannot reach an agent |
| `CALL_CENTER_CALLBACK_NUMBER` | US/Canada company callback number for that message |

Create a TwiML application with its Voice Request URL set to:

`https://YOUR-CRM/api/call-center/webhook/voice` — POST.

For each inbound Twilio number, set:

- A Call Comes In: `https://YOUR-CRM/api/call-center/webhook/inbound` — POST.
- Call Status Changes: `https://YOUR-CRM/api/call-center/webhook/customer-status` — POST.

Queue creation verifies ownership against the configured Twilio account. Saving a queue does not edit the number's routing in Twilio; set those two URLs in its console. The server creates outbound/conference callback URLs itself. Use one account consistently for API keys, app, numbers, and webhook signature validation. Browser tokens enable incoming calls and restrict outbound connections to that app; destinations and conference permissions are resolved on the server.

## Database and permissions

1. Back up the target database and apply `prisma/sql/native-call-center-additive.sql`, then `prisma/sql/native-call-center-outbound.sql`, then `prisma/sql/native-call-center-sales-roles.sql`, then `prisma/sql/native-call-center-approval.sql`, once each using your normal migration process. The first creates the six core voice tables; the second adds four outbound tables, routing/timing fields, and permits sequential reuse of a standby agent leg in participant history. The third adds closer availability, saved call qualification, and the link to the existing CloserHandoff table. The fourth adds the lender snapshot, approval request identity, Floor Manager decision, selected closer, and readiness timestamps. None of these migrations has been applied to production as part of this local implementation. Existing Call and Five9 records remain intact. Do not run `db:reset` or seed a production database. `npm start`, Railway's start command, and `server.js` start the application without schema writes. Apply reviewed migrations before deployment; automatic `db push --accept-data-loss` startup hooks have been removed.
2. Run `prisma generate` as part of the build.
3. Agents need `Call.Log`. Admins can supervise; other supervisors need the explicit `CallCenter.Supervise` permission. Their monitoring scope follows their current reporting hierarchy, not their role title. Recording playback additionally requires `Call.ListenRecording`.
4. Create inbound queues in Call Center → Campaigns & queues page → Inbound queues, and assign members. Assign human agents and leads to active non-AI campaigns in the existing Campaigns workspace.
5. Keep the long-running Node server running: the instrumentation hook dispatches automatic outbound work every second and reconciles calls every 15 seconds. A PostgreSQL lease shares dispatch budgets across replicas; contact/phone and capacity claims use transactions and locks. The scheduler is not designed for a deployment that freezes all instances between requests. Load-test the expected agent count and database latency before a broad rollout; automatic-agent screens refresh each second.

## Pilot acceptance

The automated suite covers separate page access, current role/permission checks, direct-URL rejection, provider signatures, token grants, permission boundaries, status ordering, DNC, disposition idempotency, and database constraints. It does not establish real audio quality or validate carrier provisioning.

With two agents, one supervisor, and a test handset:

1. Connect both agents in separate CRM accounts using Chrome/Edge and allow microphone access. Confirm two-way outbound audio, ringback, mute, keypad behavior against an IVR, hangup from each side, and browsing to other CRM pages during a call.
2. Call an inbound number: greeting/wait music, eligible agent ringing, answering, declining and requeueing, no available agents, caller abandonment, and maximum wait expiry.
3. Dial an assigned campaign simultaneously from two agents; confirm no double claim. Save outcomes and check call/lead history. Test callback time, suppressed numbers, retries, and power pause/resume.
4. Assign closer tiers in the existing Floor Manager. Test debts below, at, and above both saved cutoffs. Enter multiple lender amounts and verify the total, source, and brand. Request approval: confirm a CRM alert and sound for the authorized manager, then only the selected closer after approval. Verify decline, cancel, stale requests, simultaneous requests for one closer, and wrong-tier rejection. Mark the closer open and confirm the opener button becomes **Connect closer**. Verify all three participants hear the introduction; then **Leave call & next lead** must preserve client/closer audio, create one handoff record, change the lead owner, and return the opener to the next automatic call. Test closing before connection, recipient disconnect, opener disconnect, customer hangup, and closer outcomes while Open versus Closed.
5. From the supervisor, listen, whisper, and join. Confirm who hears whom and verify a normal agent cannot invoke monitor APIs. End the customer call while a supervisor is connected.
6. Enable recording only if wanted, place a new test call, and verify restricted playback. Verify logout/deactivation/revoked permissions prevent control and access.
7. Reload a browser mid-call, interrupt connectivity, restart the Node server, and replay delayed/duplicate webhooks. Check no duplicate customer call, no stuck agent reservation, and accurate final history.
8. Enable the shared web team, submit a real staging web form, and verify the first provider initiation/ringing occurs within 60 seconds. Repeat with all agents busy, outside calling hours, a DNC number, duplicate ingest, and a missed agent audio connection. Verify truthful overdue reporting and recovery without duplicate customer attempts.
9. Pilot cold dialing with controlled test handsets first. Raise the team-wide limit to 10 and above, verify maximum active lines across two server replicas, simultaneous pickups, machine/unknown results, and actual time to agent audio. Verify overflow wording, the automatic stop, cold throttling on new web leads, and no new calls after Pause. Do not use arbitrary customers to validate over-capacity handling.

Only then schedule the number-routing change and CRM mode switch. To roll back, restore `CRM_DIALER_MODE=five9`, restart the app, and restore each inbound number's previous routing. Changing the mode does not port numbers or restore provider-side routes automatically.

## Deliberate first-release boundaries

Outbound destinations are restricted to US/Canada. Cold dialing uses bounded parallel calls and observed pickup pacing, not a forecast of when busy agents will finish. Transfers are between CRM agents. Skills-based priority routing, IVR trees, voicemail inboxes, external-number transfers, agent audio-device selection, automatic transcription, and number porting are not implemented here. Maximum-wait expiry currently ends the waiting inbound call. Inbound exact-number matching leaves ambiguous records unlinked. Caller lookup does not broaden a user's access to the underlying lead record.

Real calls, audio, three-way introductions, monitoring privacy, and recording playback remain unverified until the Twilio pilot. The isolated visual preview uses labeled sample data and cannot place calls.

## References

- [Twilio browser Device](https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice)
- [Conference TwiML and coaching](https://www.twilio.com/docs/voice/twiml/conference)
- [Conference participants](https://www.twilio.com/docs/voice/api/conference-participant-resource)
- [Webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Calls API and account CPS](https://www.twilio.com/docs/voice/api/call-resource)
- [Answering machine detection](https://www.twilio.com/docs/voice/answering-machine-detection)
- [AMD latency and limitations](https://www.twilio.com/docs/voice/answering-machine-detection-faq-best-practices)
- [FTC telemarketing rule guidance](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule)
