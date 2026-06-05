# Native CRM Dialer — Phase 1 Design (Outbound + PSTN audio)

Date: 2026-06-05
Status: Approved (design); pending spec review → implementation plan

## Context

Coastal CRM (`~/debt-settlement-app`) integrates Five9 for the agent dialer. After
extended debugging on 2026-06-05 we established the ground truth (see
`src/lib/five9/agent-api.ts` and the project memory):

- The Five9 account is a fully working agent (logs into Agent Desktop Plus, `role=Agent`).
- Agent REST calls must be **cookies-only** — NO `Authorization` header (sending
  `Bearer-<token>` causes `401 "User is not logged in"`). Verified against the live
  official client: cookies-only `login_state` → `200 "WORKING"`. Fixed in commit `e87920b`.
- Login is a state machine: `auth/login` (app.five9.com) → discover active data center
  (app-atl.five9.com) → `login_state` → `session_start` (only when `SELECT_STATION`) →
  `WORKING`. Cookies are domain/host scoped (jar). farmid header is lowercase.
- Softphone (computer) audio uses a heavier modern stack: a JWT from a token-exchange
  endpoint → `api.prod.us.five9.net/agent-sessions/v1/...` to bind the station → the local
  Five9 Softphone **service** (installed, listening `:8083`/`:5060`) → **plus a Chrome
  extension** for the browser↔service bridge. Out of scope for Phase 1.
- Five9's STATION SETUP offers station types: **Softphone, PSTN, Gateway, None**.

Decisions made in brainstorming:
- Calling model: **fully native CRM dialer** (no Five9 UI shown to agents).
- Eventual scope: outbound + inbound + auto-dialer. **Build Phase 1 first, then iterate.**
- Audio: support **both PSTN and Softphone, agent-selectable**; Phase 1 ships **PSTN**,
  softphone is a later phase.
- Event channel approach (A: reimplement `digest`; B: hidden Five9 bridge): **decide after
  a discovery spike** — deferred to the inbound/auto-dialer phase.

## Goal (Phase 1)

An agent logs into Five9 from inside the CRM, picks their station (PSTN + phone number),
opens a lead, clicks Call; their phone rings and bridges to the customer; they use in-call
controls; on hangup they disposition the call and it writes back to the CRM lead pipeline.
All native CRM UI; no Five9 screens.

## In scope

1. Station setup (agent self-service): station-type picker (PSTN, None/EMPTY) + phone number for PSTN.
2. Session lifecycle: cookies-only login → state machine → `session_start` with PSTN station → `WORKING`, plus a read-only keepalive.
3. Outbound `click_to_dial` (already built) end-to-end with PSTN audio.
4. In-call controls + disposition (already built) wired in.

## Out of scope (later phases)

- Inbound calls and the `digest` event channel.
- Auto-dialer / campaigns / predictive / preview.
- Softphone (computer/browser) audio: JWT token exchange + `api.prod.us.five9.net/agent-sessions` + local service + Chrome extension bridge.
- Gateway station type.

## Architecture & components

Reuse existing modules; changes are additive.

- `src/lib/five9/agent-api.ts` (exists, auth fixed)
  - `startAgentSession(userId, stationId, stationType)` — extend to support `PSTN`
    station: when `stationType === "PSTN"`, `session_start` body carries the station type +
    the agent's phone number. Drive the existing state machine to `WORKING`.
  - Add `keepAliveSession(userId)` — calls read-only `login_state` (ensureLogin=false) to
    keep the session warm; no-op/return DISCONNECTED if no live session.
- `src/app/api/dialer/five9/agent/credentials/route.ts` (exists)
  - Accept and persist `five9StationType` (`PSTN` | `EMPTY`) and a phone number for PSTN
    (reuse `five9StationId` or add `five9StationNumber`; decide in plan).
- `src/app/(dashboard)/dialer/agent-panel.tsx` + `CredForm` (exists)
  - Station-type picker: PSTN (with phone-number input) and None/REST-only. Softphone shown
    but disabled ("coming soon").
  - Session panel: Start Session / state / Ready / Not Ready (exists).
  - Add a client-side keepalive timer (~45s) hitting a keepalive endpoint, reusing the
    read-only poll path (no login churn).
- `src/app/api/dialer/five9/agent/session/route.ts` (exists)
  - `POST` already calls `startAgentSession`; passes station type/number through.
  - Optional `PUT`/keepalive route, or reuse `GET` (read-only state) on a timer.

## Data flow (outbound call)

1. Agent saves creds + station (PSTN, number) → stored on `User`.
2. Agent clicks **Start Session** → `startAgentSession` → cookies-only login → `login_state`
   → `session_start` (PSTN station + number) → `WORKING`. Five9 calls the agent's phone and
   holds the line open.
3. Agent opens a lead → clicks **Call** → `click_to_dial` (REST) → Five9 dials the customer
   and bridges to the agent's open PSTN line. A `Call` row is written immediately.
4. In-call: hold/mute/transfer/DTMF/hangup via REST.
5. On hangup → disposition modal → CRM lead pipeline (existing disposition map + triggers).
6. Background: read-only keepalive (~45s) keeps the session alive; on 401/expiry the UI
   shows DISCONNECTED and the agent re-starts the session.

## The one spike

Confirm the exact `session_start` request for a **PSTN** station (body fields + any query
params, e.g. `appType`, `timeZoneOffset`, station type enum, phone-number field) by
capturing it from the live official client (select PSTN in STATION SETUP, observe the
request). Do this with the agent present since it will ring the agent's phone. Result feeds
the `startAgentSession` PSTN branch.

## Error handling

- No creds / no station configured → clear UI message; Start Session disabled.
- `session_start` business errors (e.g. invalid number, station busy) → surface Five9's
  message in the toast (not a generic failure).
- Session expired (401 "not logged in") → keepalive/poll reports DISCONNECTED; agent
  re-starts. Explicit actions self-heal (re-login) per existing logic; polls never log in.
- DNC: `click_to_dial` already blocks suppressed numbers (existing `isSuppressed`).

## Testing

- Unit: PSTN `session_start` body builder (pure function) — assert correct shape.
- Unit: keepalive uses read-only path (no login) — assert it never triggers a fresh login.
- Manual (with agent + phone): Start Session (PSTN) reaches WORKING and rings the phone →
  click-to-dial a test number → audio bridges → hold/mute/hangup → disposition writes to the
  lead. Verify session survives idle > keepalive interval.

## Open items for the plan

- Field for PSTN number: reuse `five9StationId` vs add `five9StationNumber`.
- Keepalive transport: client timer hitting read-only `GET /session`, vs a dedicated route.
- Exact PSTN `session_start` body (from the spike).
