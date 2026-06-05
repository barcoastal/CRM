# Native CRM Dialer — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a CRM agent log into Five9, pick a PSTN station (their phone), and place/control/disposition outbound calls entirely from the CRM, with audio bridged to their phone.

**Architecture:** Build on the cookies-only Five9 REST auth fixed in `e87920b`. Reuse the existing `agent-api.ts` state-machine login, `click_to_dial`, in-call controls, and disposition flow. Add: a PSTN station option (type + phone number, stored on `User.five9StationType`/`five9StationId`), a `session_start` body builder that handles PSTN, and a read-only session keepalive. No Five9 UI is shown to agents.

**Tech Stack:** Next.js (App Router), Prisma, TypeScript, Vitest, Five9 Agent REST (cookies-only).

**Spec:** `docs/superpowers/specs/2026-06-05-native-crm-dialer-phase1-design.md`

---

## File Structure

- `src/lib/five9/agent-api.ts` (modify) — add `buildSessionStartBody()` pure helper; use it in `startAgentSession`; add `keepAliveSession()`.
- `tests/lib/five9-session-start.test.ts` (create) — unit tests for `buildSessionStartBody`.
- `src/app/api/dialer/five9/agent/credentials/route.ts` (modify) — accept/persist `five9StationType="PSTN"` + phone number in `five9StationId`.
- `src/app/(dashboard)/dialer/agent-panel.tsx` (modify) — station-type picker (PSTN + number; Softphone disabled); keepalive timer.
- Cleanup (final task): remove temporary debug/probe endpoints.

---

## Task 1: Spike — capture the exact PSTN `session_start` wire format

**Why:** We know cookies-only auth + the state machine, but not the exact `session_start` body/query for a PSTN station. Capture it from the live official client before coding the PSTN branch. This places a real Five9 call to the agent's phone — do it with the agent present and a phone handy.

- [ ] **Step 1: Open the live Five9 Agent Desktop in the Playwright browser**

Navigate to `https://app-atl.five9.com/clients/agent/main.html?role=Agent#agent/home`. If it shows the dashboard, log out to reach STATION SETUP.

- [ ] **Step 2: Select PSTN and enter the agent's phone number**

On STATION SETUP choose **PSTN**, enter the agent's real phone/cell, click **Next**. The phone will ring — answer it.

- [ ] **Step 3: Capture the session_start request**

In Playwright, `browser_network_requests` filter `session_start`, then `browser_network_request` (full + `request-body`) on the PSTN `session_start` PUT. Record: full URL + query params (e.g. `appType`, `timeZoneOffset`, `force`), and the JSON body (station type enum + phone-number field name).

- [ ] **Step 4: Write the captured format into this plan**

Edit Task 3 below so `buildSessionStartBody` and the `session_start` query match exactly what was captured. Commit the plan update:

```bash
git add docs/superpowers/plans/2026-06-05-native-crm-dialer-phase1.md
git commit -m "docs(dialer): record captured PSTN session_start format"
```

---

## Task 2: Persist the PSTN station on the agent's credentials

**Files:**
- Modify: `src/app/api/dialer/five9/agent/credentials/route.ts`

The route already accepts `five9StationType` and `five9StationId`. PSTN reuses them: `five9StationType="PSTN"`, `five9StationId=<phone number>`. Only change: validate that when type is `PSTN`, a number is present.

- [ ] **Step 1: Add PSTN validation in the PUT handler**

In `PUT`, after parsing `body`, before the `prisma.user.update`, add:

```ts
if (body.five9StationType === "PSTN" && !body.five9StationId) {
  return NextResponse.json({ error: "PSTN station requires a phone number" }, { status: 400 });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dialer/five9/agent/credentials/route.ts
git commit -m "feat(dialer): require phone number for PSTN station"
```

---

## Task 3: `buildSessionStartBody` helper + PSTN branch in `startAgentSession`

**Files:**
- Modify: `src/lib/five9/agent-api.ts`
- Test: `tests/lib/five9-session-start.test.ts`

> NOTE: the `PSTN` body/enum below is the expected default; if Task 1's capture differs, use the captured values.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/five9-session-start.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSessionStartBody } from "../../src/lib/five9/agent-api";

describe("buildSessionStartBody", () => {
  it("PSTN sends the phone number as stationId", () => {
    expect(buildSessionStartBody("PSTN", "+19045551234")).toEqual({
      stationId: "+19045551234",
      stationType: "PSTN",
    });
  });
  it("EMPTY sends an empty station (REST-only)", () => {
    expect(buildSessionStartBody("EMPTY", "")).toEqual({ stationId: "", stationType: "EMPTY" });
  });
  it("falls back to EMPTY for unknown types", () => {
    expect(buildSessionStartBody("WAT" as never, "x")).toEqual({ stationId: "", stationType: "EMPTY" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/five9-session-start.test.ts`
Expected: FAIL — `buildSessionStartBody` is not exported.

- [ ] **Step 3: Add the helper and use it**

In `src/lib/five9/agent-api.ts`, add near the top (after imports):

```ts
/** Build the session_start body for a station type. PSTN/STATION carry the
 * stationId (PSTN = the agent's phone number); EMPTY/SOFTPHONE/unknown send
 * an empty station. Confirmed against the live Five9 client (Task 1 spike). */
export function buildSessionStartBody(
  stationType: "EMPTY" | "SOFTPHONE" | "STATION" | "PSTN",
  stationId: string,
): { stationId: string; stationType: string } {
  switch (stationType) {
    case "PSTN":
      return { stationId, stationType: "PSTN" };
    case "STATION":
      return { stationId, stationType: "STATION" };
    default:
      return { stationId: "", stationType: "EMPTY" };
  }
}
```

Then in `startAgentSession`, replace the existing `const body = stationType === "STATION" ? ... : ...;` line with:

```ts
  const body = buildSessionStartBody(stationType as "EMPTY" | "SOFTPHONE" | "STATION" | "PSTN", stationId);
```

And widen the `stationType` parameter type of `startAgentSession` to include `"PSTN"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/five9-session-start.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/lib/five9/agent-api.ts tests/lib/five9-session-start.test.ts
git commit -m "feat(five9-agent): PSTN session_start body builder"
```

---

## Task 4: Thread `stationType="PSTN"` through the session route

**Files:**
- Modify: `src/app/api/dialer/five9/agent/session/route.ts`

The `POST` already reads `five9StationType` from the user and passes it to `startAgentSession`. Confirm `"PSTN"` flows through and the cast accepts it.

- [ ] **Step 1: Widen the stationType cast in POST**

Find the `const stationType = (... ) as "EMPTY" | "SOFTPHONE" | "STATION"` line and add `| "PSTN"`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dialer/five9/agent/session/route.ts
git commit -m "feat(dialer): allow PSTN station type in session route"
```

---

## Task 5: Station-type picker (PSTN + number) in the agent panel

**Files:**
- Modify: `src/app/(dashboard)/dialer/agent-panel.tsx`

The `CredForm` already has a Station Type `<select>` with EMPTY/SOFTPHONE/STATION. Replace with PSTN-first options; show Softphone disabled.

- [ ] **Step 1: Update the station-type select options**

In `CredForm`, replace the `<select>` `<option>`s with:

```tsx
<option value="EMPTY">REST-only (click-to-dial, no audio)</option>
<option value="PSTN">Phone (PSTN) — Five9 calls my phone</option>
<option value="SOFTPHONE" disabled>Browser softphone (coming soon)</option>
```

- [ ] **Step 2: Show the phone-number field for PSTN**

Change the conditional that currently renders the Station ID input `when stationType === "STATION"` to also render for `"PSTN"`, with a PSTN-specific label:

```tsx
{(form.stationType === "STATION" || form.stationType === "PSTN") && (
  <>
    <label style={lbl}>{form.stationType === "PSTN" ? "Your phone number" : "Station ID"}</label>
    <input
      value={form.stationId}
      onChange={(e) => setForm({ ...form, stationId: e.target.value })}
      style={input}
      placeholder={form.stationType === "PSTN" ? "+1 904 555 1234" : "e.g. 1001"}
    />
  </>
)}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dialer/agent-panel.tsx"
git commit -m "feat(dialer): PSTN station picker + phone number field"
```

---

## Task 6: Session keepalive (read-only, no login churn)

**Files:**
- Modify: `src/app/(dashboard)/dialer/agent-panel.tsx`

Once `WORKING`, keep the Five9 session warm with a read-only `login_state` poll. Reuse the existing `GET /api/dialer/five9/agent/session` (which is read-only / never logs in). Add a ~45s timer that runs only while connected.

- [ ] **Step 1: Add a keepalive effect**

In `AgentPanel`, after the existing polling effect, add:

```tsx
useEffect(() => {
  if (sessionState?.state !== "WORKING" && sessionState?.state !== "READY" && sessionState?.state !== "NOT_READY") return;
  const id = setInterval(() => { void refreshSession(); }, 45_000);
  return () => clearInterval(id);
}, [sessionState?.state]);
```

(`refreshSession` already calls the read-only `GET /session`, which keeps the session alive without logging in.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/dialer/agent-panel.tsx"
git commit -m "feat(dialer): keep Five9 session warm with read-only keepalive"
```

---

## Task 7: End-to-end manual integration test (agent + phone)

**Why:** Telephony can only be truly verified live. No code; this is the acceptance gate.

- [ ] **Step 1: Deploy** — push `main`; wait for Railway to go green.
- [ ] **Step 2: Configure station** — in the CRM dialer, set Five9 creds + Station Type = PSTN + phone number; Save.
- [ ] **Step 3: Start Session** — click Start Session. Expected: status reaches WORKING/READY and your phone rings (Five9 opening the PSTN line); answer it.
- [ ] **Step 4: Click-to-dial** — open a test lead, click Call to a number you control. Expected: that number rings and bridges to your phone; CRM shows the active call.
- [ ] **Step 5: Controls + disposition** — test hold/mute/hangup; on hangup choose a disposition; verify it writes to the lead (LeadHistory/status).
- [ ] **Step 6: Idle survival** — leave the dialer idle > 1 min; confirm status stays connected (keepalive) and a second call still works.

---

## Task 8: Remove temporary debug/probe endpoints

**Files:**
- Delete: `src/app/api/dialer/five9/agent/debug-flow/`, `debug-login/`, `test-login/`, `probe-paths/`, `probe-bodies/`, `src/app/api/dialer/five9/admin/debug-xml/`

These were diagnostic only and `debug-flow`/`debug-login` expose login internals. Remove now that the integration is confirmed.

- [ ] **Step 1: Delete the endpoint directories**

```bash
cd ~/debt-settlement-app
rm -rf src/app/api/dialer/five9/agent/debug-flow \
       src/app/api/dialer/five9/agent/debug-login \
       src/app/api/dialer/five9/agent/test-login \
       src/app/api/dialer/five9/agent/probe-paths \
       src/app/api/dialer/five9/agent/probe-bodies \
       src/app/api/dialer/five9/admin/debug-xml
```

- [ ] **Step 2: Verify nothing references them + build**

Run: `grep -rn "debug-flow\|debug-login\|probe-paths\|probe-bodies\|debug-xml" src/ ; npm run build`
Expected: no references; `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add -A src/app/api/dialer/five9
git commit -m "chore(five9): remove temporary debug/probe endpoints"
```

---

## Notes

- Keep the `test-login` UI button? It calls `/agent/test-login`; if that endpoint is removed in Task 8, also remove the "Test saved login" button in `agent-panel.tsx` (and `testLogin`/its handler) in the same commit to avoid a dead call.
- Phase 2 (inbound + `digest` event channel) and Phase 3 (auto-dialer) and softphone audio are separate plans.
