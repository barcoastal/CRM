"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Plus,
  X,
  Headphones,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneOff,
  Play,
  Radio,
  LayoutDashboard,
  BriefcaseBusiness,
  AudioLines,
  Route,
  Zap,
  History,
  ContactRound,
  ListTodo,
  ArrowUpRight,
  ChevronRight,
  LockKeyhole,
  Search,
  Clock3,
  CircleCheck,
  Users,
} from "lucide-react";
import { usePhone } from "./provider";
import {
  CALL_CENTER_PATHS,
  type CallCenterScreen,
} from "@/lib/call-center/access";
import "./console.css";
import "./opener.css";
import { HandoffRequests, HandoffBrief } from "./handoff-panels";
import { APPROVAL_STAGES, debtTotal } from "@/lib/call-center/qualification";
import { OperationsWorkspace } from "./operations-workspace";
import type { Overview, VoiceCall } from "./types";
import { isTerminal } from "@/lib/call-center/model";
import { closerDebtRange, tierForDebt } from "@/lib/closer-tier-config";

type Person = NonNullable<Overview["sales"]>["roster"][number];
const money = (n?: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(n);
const labels: Record<string, string> = {
  ON_CALL: "On a call",
  OPEN: "Open",
  READY: "Ready",
  CLOSED: "Closed",
  PAUSED: "Paused",
  OFFLINE: "Offline",
  WRAP_UP: "Wrap up",
  RESERVED: "Reserved",
};
function Status({ state }: { state: string }) {
  return (
    <span
      className={`cc-badge ${["OPEN", "READY"].includes(state) ? "green" : state === "ON_CALL" ? "blue" : state === "WRAP_UP" ? "amber" : ""}`}
    >
      <span className="cc-status-dot" />
      {labels[state] || state.replaceAll("_", " ")}
    </span>
  );
}
function Duration({ call, now }: { call: VoiceCall; now: number }) {
  if (!call.answeredAt)
    return (
      <span>{call.status === "RINGING" ? "Ringing…" : "Connecting…"}</span>
    );
  const secs = Math.max(
    0,
    Math.floor(
      ((call.endedAt ? Date.parse(call.endedAt) : now) -
        Date.parse(call.answeredAt)) /
        1000,
    ),
  );
  return (
    <span className="cc-duration">
      {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
    </span>
  );
}
export function OpenerScreen() {
  return (
    <ScreenFrame screen="opener">
      <Opener />
    </ScreenFrame>
  );
}
export function CloserScreen() {
  return (
    <ScreenFrame screen="closer">
      <Closer />
    </ScreenFrame>
  );
}
export function LiveFloorScreen() {
  return (
    <ScreenFrame screen="floor">
      <LiveFloor />
    </ScreenFrame>
  );
}
export function CallCenterOperationsScreen() {
  return (
    <ScreenFrame screen="operations">
      <div className="cc-operations">
        <OperationsWorkspace />
      </div>
    </ScreenFrame>
  );
}
function useClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
function ScreenFrame({
  screen,
  children,
}: {
  screen: CallCenterScreen;
  children: React.ReactNode;
}) {
  const p = usePhone();
  const manager = screen === "floor" || screen === "operations";
  const own = p.data?.sales?.roster.find((x) => x.id === p.data?.userId);
  const access = p.data?.sales?.access;
  const title = {
    opener: "Opener desk",
    closer: "Closer desk",
    floor: "Live floor",
    operations: "Campaigns & queues",
  }[screen];
  const NavIcon = manager
    ? LayoutDashboard
    : screen === "closer"
      ? BriefcaseBusiness
      : Headphones;
  return (
    <div className={`cc-workspace cc-console cc-console-${screen}`}>
      {screen !== "opener" && (
        <aside className="cc-console-rail">
          <Link className="cc-console-brand" href="/call-center">
            <span>
              <AudioLines size={22} />
            </span>
            <div>
              coastal<strong>CALL CENTER</strong>
            </div>
          </Link>
          <div className="cc-rail-section">
            {manager ? "MANAGEMENT" : "YOUR WORKSPACE"}
          </div>
          <nav aria-label={`${title} navigation`}>
            <Link
              aria-label={manager ? "Live floor" : "My calling desk"}
              title={manager ? "Live floor" : "My calling desk"}
              className={screen !== "operations" ? "selected" : ""}
              href={CALL_CENTER_PATHS[manager ? "floor" : screen]}
            >
              <NavIcon size={17} />
              <span>{manager ? "Live floor" : "My calling desk"}</span>
            </Link>
            {manager ? (
              <>
                {access?.operations && (
                  <Link
                    aria-label="Campaigns & queues"
                    title="Campaigns & queues"
                    className={screen === "operations" ? "selected" : ""}
                    href={CALL_CENTER_PATHS.operations}
                  >
                    <Radio size={17} />
                    <span>Campaigns & queues</span>
                  </Link>
                )}
                <Link
                  href="/floor-manager/closers"
                  aria-label="Closer routing"
                  title="Closer routing"
                >
                  <Route size={17} />
                  <span>Closer routing</span>
                </Link>
              </>
            ) : (
              <a href="#handoffs" aria-label="My handoffs" title="My handoffs">
                <History size={17} />
                <span>My handoffs</span>
              </a>
            )}
          </nav>
          <div className="cc-rail-section">CRM</div>
          <nav aria-label="Related CRM records">
            <Link href="/leads" aria-label="Leads" title="Leads">
              <ContactRound size={17} />
              <span>Leads</span>
              <ArrowUpRight size={13} />
            </Link>
            <Link href="/tasks" aria-label="Tasks" title="Tasks">
              <ListTodo size={17} />
              <span>Tasks</span>
              <ArrowUpRight size={13} />
            </Link>
            {manager && (access?.opener || access?.closer) && (
              <Link
                href={CALL_CENTER_PATHS[access.closer ? "closer" : "opener"]}
                aria-label="My calling desk"
                title="My calling desk"
              >
                <Phone size={17} />
                <span>My calling desk</span>
                <ArrowUpRight size={13} />
              </Link>
            )}
          </nav>
          <div className="cc-rail-phone">
            <div>
              <span className={`cc-dot ${p.connected ? "green" : ""}`} />
              {p.connected ? "Headset connected" : "Headset offline"}
            </div>
            <small>Your phone stays with you across the CRM.</small>
            <button onClick={() => p.setOpen(true)}>
              <Headphones size={15} />
              Open phone
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="cc-rail-user">
            <span>{initials(own?.name || "Agent")}</span>
            <div>
              <strong>{own?.name || "Your workspace"}</strong>
              <small>
                {manager
                  ? "Floor management"
                  : screen === "closer"
                    ? `Closer${own?.tier ? ` · Tier ${own.tier}` : ""}`
                    : "Opener"}
              </small>
            </div>
            <span className={`cc-dot ${p.connected ? "green" : ""}`} />
          </div>
        </aside>
      )}
      <div className="cc-console-main">
        {screen !== "opener" && (
          <header className="cc-console-top">
            <div>
              <span>Call center</span>
              <ChevronRight size={13} />
              <strong>{title}</strong>
            </div>
            <div>
              <span className="cc-console-live">
                <span className={`cc-dot ${p.connected ? "green" : ""}`} />
                {p.connected ? "Phone connected" : "Phone offline"}
              </span>
              <button
                className="cc-icon-button"
                aria-label="Open CRM phone"
                onClick={() => p.setOpen(true)}
              >
                <Headphones size={18} />
              </button>
            </div>
          </header>
        )}
        <main className="cc-console-body">
          {p.error && (
            <div className="cc-error" role="alert">
              {p.error}
              <button onClick={() => p.setError("")}>Dismiss</button>
            </div>
          )}
          {!p.data ? (
            <div className="cc-empty">
              <Headphones />
              <h2>Loading your workspace…</h2>
            </div>
          ) : !access?.[screen] ? (
            <div className="cc-empty">
              <LockKeyhole />
              <h2>This workspace is assigned to another role.</h2>
              <Link href={access?.home || "/call-center"}>
                Go to my workspace
              </Link>
            </div>
          ) : (
            <>
              {(!p.data.setup.enabled || !p.data.setup.ready) && (
                <div className="cc-setup-banner">
                  <Headphones size={19} />
                  <div>
                    <strong>Connect Twilio to start calling</strong>
                    <p>
                      The workspace is ready. Your phone will be available after
                      setup.
                    </p>
                  </div>
                </div>
              )}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
function useAction() {
  const p = usePhone();
  const [saving, setSaving] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    p.setError("");
    try {
      await action();
      await p.refresh();
    } catch (e) {
      p.setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }
  return { saving, run };
}
function CallControls() {
  const p = usePhone();
  const { saving, run } = useAction();
  if (!p.active) return null;
  if (isTerminal(p.active.status))
    return (
      <button className="cc-button primary" onClick={() => p.setOpen(true)}>
        Save outcome & finish wrap up <ArrowRight size={15} />
      </button>
    );
  if (p.incoming)
    return (
      <div className="cc-sales-actions">
        <button className="cc-button primary" onClick={p.accept}>
          <Phone size={15} /> Answer call
        </button>
        <button className="cc-button danger" onClick={p.reject}>
          Decline
        </button>
      </div>
    );
  return (
    <div className="cc-sales-actions">
      <button className="cc-button" onClick={p.mute}>
        {p.muted ? <MicOff size={15} /> : <Mic size={15} />}
        {p.muted ? "Unmute" : "Mute"}
      </button>
      <button className="cc-button" onClick={() => p.setOpen(true)}>
        Phone controls
      </button>
      <button
        className="cc-button danger"
        disabled={saving}
        onClick={() => void run(p.hangup)}
      >
        <PhoneOff size={15} />
        End call
      </button>
    </div>
  );
}
function ClientHeader({ call, now }: { call: VoiceCall; now: number }) {
  const lead = call.call?.lead;
  return (
    <div className="cc-client-header">
      <div className="cc-client-name">
        <span className="cc-client-avatar">
          {(lead?.contactName || "Client")
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <div className="cc-eyebrow">
            {isTerminal(call.status)
              ? "WRAP UP"
              : call.workflow === "WEB"
                ? "PRIORITY WEB LEAD"
                : call.workflow === "COLD"
                  ? "COLD CAMPAIGN"
                  : "CURRENT CLIENT"}
          </div>
          <h2>{lead?.contactName || call.phoneNumber}</h2>
          <p>{lead?.businessName || call.phoneNumber}</p>
        </div>
      </div>
      <div className="cc-client-time">
        <span className="cc-badge blue">
          <Phone size={12} />
          {isTerminal(call.status)
            ? "Call finished"
            : call.held
              ? "Client on hold"
              : "Live call"}
        </span>
        <Duration
          call={call}
          now={now || Date.parse(call.answeredAt || call.createdAt)}
        />
      </div>
      <div className="cc-client-meta">
        <span>{call.phoneNumber}</span>
        {lead?.source && <span>{lead.source.replaceAll("_", " ")}</span>}
        {call.leadId && (
          <Link href={`/leads/${call.leadId}`}>Open client record ↗</Link>
        )}
      </div>
    </div>
  );
}
function Opener() {
  const now = useClock();
  const p = usePhone();
  const { saving, run } = useAction();
  const data = p.data!;
  const ownRole = data.sales?.role !== "CLOSER";
  const call = ownRole ? p.active : null;
  const own = data.sales?.roster.find((person) => person.id === data.userId);
  return (
    <>
      <header className="cc-opener-toolbar">
        <div className="cc-opener-identity">
          <span className="cc-opener-app-icon" aria-hidden="true">
            <Headphones size={20} />
          </span>
          <h1>Opener desk</h1>
          <span className="cc-opener-agent">{own?.name}</span>
        </div>
        <div className="cc-opener-tools">
          <Link href="/leads">
            Leads <ArrowUpRight size={14} />
          </Link>
          <span className="cc-opener-connection">
            <span className={`cc-dot ${p.connected ? "green" : ""}`} />
            {p.connected ? "Phone connected" : "Phone offline"}
          </span>
          {!p.connected ? (
            <button
              className="cc-button primary"
              disabled={
                p.connecting || !data.setup.ready || !data.setup.enabled
              }
              onClick={() => void p.connect()}
            >
              <Headphones size={16} />
              {p.connecting ? "Connecting…" : "Connect phone"}
            </button>
          ) : (
            <button
              className={`cc-button ${p.automatic ? "" : "primary"}`}
              disabled={saving || p.busy || !!p.active || !ownRole}
              title={
                p.active
                  ? "Finish the current call before changing dialing status"
                  : undefined
              }
              onClick={() =>
                void run(p.automatic ? p.leaveOutbound : p.joinOutbound)
              }
            >
              {p.automatic ? <Pause size={15} /> : <Play size={15} />}
              {p.automatic ? "Pause dialing" : "Start dialing"}
            </button>
          )}
        </div>
      </header>
      {call ? (
        <OpenerCall key={call.id} call={call} now={now} />
      ) : (
        <div className="cc-opener-workarea">
          <section className="cc-opener-idle" aria-label="Current lead">
            <h2>
              {p.automatic ? "Waiting for the next lead" : "No active call"}
            </h2>
            <p>
              {p.automatic
                ? "Your next answered call will appear here. Web leads have priority."
                : "Start dialing to receive calls, or open a lead to call them directly."}
            </p>
          </section>
          <aside
            className="cc-opener-transfers"
            aria-label="Closer availability"
          >
            <header className="cc-opener-section-heading">
              <h2>Closers</h2>
            </header>
            <CloserRoster />
          </aside>
        </div>
      )}
    </>
  );
}
function OpenerCall({ call, now }: { call: VoiceCall; now: number }) {
  const p = usePhone();
  const { saving, run } = useAction();
  const lead = call.call?.lead;
  const ended = isTerminal(call.status);
  const [debts, setDebts] = useState<
    { key: string; id?: string; creditorName: string; amount: string }[]
  >(() =>
    (call.qualifiedDebts?.length
      ? call.qualifiedDebts
      : lead?.debts?.length
        ? lead.debts.map((row) => ({ ...row, key: row.id }))
        : [{ key: "new-row", creditorName: "", amount: "" }]
    ).map((row) => ({
      ...row,
      creditorName: row.creditorName || "",
      amount: String(row.amount),
    })),
  );
  const [removedDebtIds, setRemovedDebtIds] = useState<string[]>([]);
  const [notes, setNotes] = useState(call.qualificationNotes || "");
  const debt = debtTotal(
    debts.map((row) => ({ amount: Number(row.amount) || 0 })),
  );
  const config = p.data!.sales?.config;
  const tier =
    config && Number(debt) > 0 ? tierForDebt(Number(debt), config) : null;
  const savedTier =
    config && call.qualifiedDebt
      ? tierForDebt(call.qualifiedDebt, config)
      : null;
  const pending = ["TRANSFER_PENDING", "TRANSFER_CANCELING"].includes(
    call.salesStage || "",
  );
  const requested = APPROVAL_STAGES.includes(call.salesStage || "");
  const transfer = call.participants.find(
    (person) => person.role === "TRANSFER" && !person.endedAt,
  );
  const receiver = p.data?.sales?.roster.find(
    (person) => person.id === call.transferTargetId,
  );
  const unchanged =
    !!call.qualifiedAt &&
    debts.length === call.qualifiedDebts?.length &&
    debts.every(
      (row, index) =>
        row.creditorName.trim() ===
          call.qualifiedDebts?.[index]?.creditorName &&
        Number(row.amount) === call.qualifiedDebts?.[index]?.amount,
    ) &&
    notes.trim() === call.qualificationNotes;
  return (
    <div className="cc-opener-workarea">
      <section className="cc-opener-lead" aria-label="Current lead">
        <header className="cc-opener-client">
          <div className="cc-opener-record-label">
            <span>
              {call.workflow === "WEB"
                ? "Web lead"
                : call.workflow === "COLD"
                  ? "Cold lead"
                  : "Current lead"}
            </span>
            {call.leadId && (
              <Link href={`/leads/${call.leadId}`}>
                View lead <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          <h2>{lead?.contactName || call.phoneNumber}</h2>
          <div className="cc-opener-client-meta">
            {lead?.businessName && <p>{lead.businessName}</p>}
            <span className="cc-opener-number">{call.phoneNumber}</span>
          </div>
          <div className="cc-opener-origin">
            <span>
              Source<strong>{lead?.source || "Not provided"}</strong>
            </span>
            <span>
              Brand<strong>{lead?.brand || "Not provided"}</strong>
            </span>
          </div>
          {lead?.sfId && (
            <div className="cc-opener-sf">Received from Salesforce</div>
          )}
        </header>
        <div className="cc-opener-callbar">
          <div className="cc-opener-callstate" role="status">
            <span className="cc-opener-line-icon" aria-hidden="true">
              <Phone size={18} />
            </span>
            <strong>
              {ended
                ? "Wrap up"
                : call.held
                  ? "Client on hold"
                  : call.status === "IN_PROGRESS"
                    ? "On call"
                    : call.status === "RINGING"
                      ? "Ringing"
                      : "Connecting"}
            </strong>
            <Duration
              call={call}
              now={now || Date.parse(call.answeredAt || call.createdAt)}
            />
          </div>
          <CallControls />
        </div>
        <div className="cc-qualification">
          <header className="cc-opener-section-heading">
            <h2>Qualification</h2>
            {unchanged && (
              <span className="cc-opener-saved">
                <Check size={14} /> Saved
              </span>
            )}
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() =>
                p.command({
                  action: "qualify",
                  id: call.id,
                  debts: debts.map((row) => ({
                    ...row,
                    amount: Number(row.amount),
                  })),
                  removedDebtIds,
                  notes,
                }),
              );
            }}
          >
            <fieldset
              disabled={saving || requested || call.status !== "IN_PROGRESS"}
            >
              <div className="cc-debt-editor-head">
                <span>Lender</span>
                <span>Debt amount ($)</span>
                <span />
              </div>
              {debts.map((row, index) => (
                <div className="cc-debt-row" key={row.key}>
                  <input
                    aria-label={`Lender ${index + 1}`}
                    required
                    maxLength={200}
                    value={row.creditorName}
                    placeholder="Lender name"
                    onChange={(event) =>
                      setDebts((rows) =>
                        rows.map((item) =>
                          item.key === row.key
                            ? { ...item, creditorName: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={`Debt for lender ${index + 1}`}
                    required
                    type="number"
                    min="0.01"
                    max="1000000000"
                    step="0.01"
                    value={row.amount}
                    placeholder="0.00"
                    onChange={(event) =>
                      setDebts((rows) =>
                        rows.map((item) =>
                          item.key === row.key
                            ? { ...item, amount: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Remove lender ${index + 1}`}
                    disabled={debts.length === 1}
                    onClick={() => {
                      if ("id" in row && row.id)
                        setRemovedDebtIds((ids) => [...ids, row.id!]);
                      setDebts((rows) =>
                        rows.filter((item) => item.key !== row.key),
                      );
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button
                className="cc-debt-add"
                type="button"
                disabled={debts.length >= 100}
                onClick={() =>
                  setDebts((rows) => [
                    ...rows,
                    { key: crypto.randomUUID(), creditorName: "", amount: "" },
                  ])
                }
              >
                <Plus size={14} />
                Add lender
              </button>
              <div className="cc-debt-total">
                <span>
                  Total confirmed debt
                  <small>
                    {debts.length} {debts.length === 1 ? "lender" : "lenders"}
                  </small>
                </span>
                <strong>{money(debt)}</strong>
              </div>
              <label>
                Notes for the closer
                <textarea
                  required
                  maxLength={10000}
                  rows={5}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Client situation and details for the handoff"
                />
              </label>
              <div className="cc-qualification-save">
                <span>
                  {tier ? (
                    <>
                      Tier {tier} ·{" "}
                      {closerDebtRange(
                        tier,
                        config!.tier1Max,
                        config!.tier2Max,
                      )}
                    </>
                  ) : (
                    "Enter debt to find the matching closer team"
                  )}
                </span>
                <button
                  className="cc-button"
                  type="submit"
                  disabled={unchanged}
                >
                  {saving ? "Saving…" : "Save qualification"}
                </button>
              </div>
            </fieldset>
          </form>
          {ended && (
            <p className="cc-opener-wrapup">
              Save the call outcome to receive the next lead.
            </p>
          )}
        </div>
      </section>
      <aside className="cc-opener-transfers" aria-label="Transfer to a closer">
        <header className="cc-opener-section-heading">
          <h2>Transfer to a closer</h2>
          {savedTier && <span>Tier {savedTier}</span>}
        </header>
        <div className="cc-opener-approval">
          <ol>
            <li
              className={
                call.transferReviewedAt &&
                call.salesStage !== "TRANSFER_REJECTED"
                  ? "done"
                  : ""
              }
            >
              <b>1</b>
              <span>
                <strong>Floor Manager approval</strong>
                {call.salesStage === "PENDING_APPROVAL"
                  ? "Request sent · waiting for approval"
                  : call.transferReviewedAt &&
                      call.salesStage !== "TRANSFER_REJECTED"
                    ? "Approved"
                    : "Required before connecting a closer"}
              </span>
            </li>
            <li className={call.transferReadyAt ? "done" : ""}>
              <b>2</b>
              <span>
                <strong>{receiver?.name || "Closer readiness"}</strong>
                {call.transferReadyAt
                  ? "Marked open for this client"
                  : call.salesStage === "PENDING_CLOSER"
                    ? "Ping sent · waiting for closer to mark open"
                    : "Closer receives a ping after approval"}
              </span>
            </li>
          </ol>
          {call.transferReason && (
            <p
              className={
                call.salesStage === "TRANSFER_REJECTED"
                  ? "cc-request-rejected"
                  : ""
              }
            >
              {call.salesStage === "TRANSFER_REJECTED"
                ? "Declined: "
                : "Manager note: "}
              {call.transferReason}
            </p>
          )}
        </div>
        <CloserRoster
          debt={call.qualifiedDebt || debt}
          selected={call.transferTargetId || undefined}
          show={savedTier || tier ? "matching" : "all"}
        />
        <div className="cc-opener-handoff">
          {ended ? (
            <p>The call has ended.</p>
          ) : pending ? (
            <>
              <h3>
                {transfer?.joinedAt
                  ? `${receiver?.name || "Closer"} joined the call`
                  : transfer
                    ? `Connecting ${receiver?.name || "closer"}…`
                    : "Closer did not connect"}
              </h3>
              <p>
                {transfer?.joinedAt
                  ? "Introduce the client and closer. Leave when the introduction is complete; they stay on the call."
                  : "You and the client remain together while the closer connects."}
              </p>
              <button
                className="cc-button primary"
                disabled={
                  saving ||
                  !transfer?.joinedAt ||
                  call.salesStage === "TRANSFER_CANCELING"
                }
                onClick={() =>
                  void run(() =>
                    p.command({ action: "complete-transfer", id: call.id }),
                  )
                }
              >
                Leave call & next lead <ArrowRight size={15} />
              </button>
              <button
                className="cc-button"
                disabled={saving}
                onClick={() =>
                  void run(() =>
                    p.command({ action: "cancel-transfer", id: call.id }),
                  )
                }
              >
                Cancel handoff
              </button>
            </>
          ) : (
            <>
              <button
                className="cc-button primary"
                disabled={
                  saving ||
                  !unchanged ||
                  (requested && call.salesStage !== "CLOSER_READY")
                }
                onClick={() =>
                  void run(() =>
                    p.command({
                      action:
                        call.salesStage === "CLOSER_READY"
                          ? "qualified-transfer"
                          : "request-transfer",
                      id: call.id,
                    }),
                  )
                }
              >
                <ArrowRightLeft size={16} />
                {call.salesStage === "CLOSER_READY"
                  ? "Connect closer"
                  : call.salesStage === "PENDING_APPROVAL"
                    ? "Waiting for Floor Manager"
                    : call.salesStage === "PENDING_CLOSER"
                      ? "Waiting for closer"
                      : "Request transfer approval"}
              </button>
              <p>
                {!unchanged
                  ? "Save lender details and notes before requesting approval."
                  : call.salesStage === "CLOSER_READY"
                    ? "Adds the closer to your call with the client."
                    : "Keep speaking with the client while approval is pending."}
              </p>
              {requested && (
                <button
                  className="cc-button"
                  disabled={saving}
                  onClick={() =>
                    void run(() =>
                      p.command({
                        action: "cancel-transfer-request",
                        id: call.id,
                      }),
                    )
                  }
                >
                  Cancel request
                </button>
              )}
            </>
          )}
        </div>
        {savedTier && (
          <details className="cc-opener-other-teams">
            <summary>Other debt ranges</summary>
            <CloserRoster debt={call.qualifiedDebt} show="other" />
          </details>
        )}
      </aside>
    </div>
  );
}
function CloserRoster({
  debt,
  selected,
  onSelect,
  selectable = false,
  show = "all",
}: {
  debt?: number | null;
  selected?: string;
  onSelect?: (id: string) => void;
  selectable?: boolean;
  show?: "all" | "matching" | "other";
}) {
  const sales = usePhone().data!.sales;
  const matching = sales && debt ? tierForDebt(debt, sales.config) : null;
  const tiers =
    show === "matching" && matching
      ? [matching]
      : show === "other"
        ? [1, 2, 3].filter((tier) => tier !== matching)
        : [1, 2, 3];
  return (
    <div className="cc-opener-roster">
      {tiers.map((tier) => {
        const people =
          sales?.roster.filter(
            (person) => person.role === "CLOSER" && person.tier === tier,
          ) || [];
        return (
          <section
            key={tier}
            className={`cc-opener-tier ${matching === tier ? "matching" : ""}`}
          >
            <header>
              <strong>
                Tier {tier}
                {matching === tier && <span> · Matching debt range</span>}
              </strong>
              <small>
                {sales
                  ? closerDebtRange(
                      tier,
                      sales.config.tier1Max,
                      sales.config.tier2Max,
                    )
                  : "No routing configured"}
              </small>
            </header>
            {people.length ? (
              people.map((person) => {
                const eligible = matching === tier && person.state === "OPEN";
                return (
                  <label
                    className={`cc-opener-person ${selected === person.id ? "selected" : ""}`}
                    key={person.id}
                  >
                    {onSelect && (
                      <input
                        type="radio"
                        name="closer-destination"
                        value={person.id}
                        checked={selected === person.id}
                        disabled={!selectable || !eligible}
                        onChange={() => onSelect(person.id)}
                      />
                    )}
                    <span
                      className="cc-opener-person-avatar"
                      aria-hidden="true"
                    >
                      {initials(person.name)}
                    </span>
                    <span className="cc-opener-person-info">
                      <strong>{person.name}</strong>
                      <Status state={person.state} />
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="cc-opener-no-closers">No closers assigned</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
function Closer() {
  const now = useClock();
  const p = usePhone();
  const data = p.data!;
  const { saving, run } = useAction();
  const sales = data.sales;
  const self = sales?.roster.find((x) => x.id === data.userId);
  const ownRole = sales?.role === "CLOSER";
  const call = ownRole ? p.active : null;
  const opener = sales?.roster.find((x) => x.id === call?.openerId);
  const open = !!data.me?.closerOpen;
  return (
    <>
      <div className="cc-role-heading">
        <div>
          <span className="cc-page-kicker">QUALIFIED CONVERSATIONS</span>
          <h1>Closer desk</h1>
          <p>
            Receive qualified clients with their debt, lender details, and
            opener notes.
          </p>
        </div>
        <div className="cc-sales-actions">
          {!p.connected && (
            <button
              className="cc-button"
              disabled={
                p.connecting || !data.setup.enabled || !data.setup.ready
              }
              onClick={() => void p.connect()}
            >
              Connect phone
            </button>
          )}
          <div
            className="cc-availability-toggle"
            aria-label="Closer transfer availability"
          >
            <button
              aria-pressed={!open}
              disabled={saving || !ownRole}
              className={!open ? "selected" : ""}
              onClick={() =>
                void run(() =>
                  p.command({ action: "closer-open", open: false }),
                )
              }
            >
              <Pause size={14} />
              Closed
            </button>
            <button
              aria-pressed={open}
              disabled={saving || !ownRole || !p.connected || !self?.tier}
              className={open ? "selected open" : ""}
              onClick={() =>
                void run(() => p.command({ action: "closer-open", open: true }))
              }
            >
              <span className="cc-dot green" />
              Open
            </button>
          </div>
        </div>
      </div>
      <HandoffRequests />
      <div className={`cc-closer-banner ${open ? "is-open" : ""}`}>
        <span className="cc-banner-icon">
          <ArrowRightLeft size={23} />
        </span>
        <div>
          <strong>
            {ownRole
              ? open
                ? call
                  ? "Open for transfers · Currently on a call"
                  : "You are open for qualified transfers"
                : "You are closed for new transfers"
              : "Closer access follows your Floor Manager role"}
          </strong>
          <p>
            {ownRole
              ? self?.tier && sales
                ? `Tier ${self.tier} · ${closerDebtRange(self.tier, sales.config.tier1Max, sales.config.tier2Max)} · ${call ? "Your current call continues. New transfers wait until you are free." : "Only matching debt amounts route to you."}`
                : "A manager must assign your closer tier in Floor Manager."
              : "Your account is an opener. Closer availability is managed by each assigned closer."}
          </p>
        </div>
        {ownRole && <Status state={self?.state || "CLOSED"} />}
      </div>
      <ActivitySummary role="CLOSER" />
      <div className="cc-sales-grid cc-closer-grid">
        <div className="cc-main-column">
          {call ? (
            <section className="cc-card">
              <ClientHeader call={call} now={now} />
              <div className="cc-client-body">
                <CallControls />
                <HandoffBrief call={call} />
                <div className="cc-qualified-details">
                  <div>
                    <span>Confirmed debt</span>
                    <strong>{money(call.qualifiedDebt)}</strong>
                  </div>
                  <div>
                    <span>Lenders</span>
                    <strong>{call.call?.lead?.numberOfLenders ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Opener</span>
                    <strong>{opener?.name || "—"}</strong>
                  </div>
                </div>
                <div className="cc-brief-label">
                  <span>
                    <ContactRound size={15} />
                    QUALIFICATION BRIEF
                  </span>
                  {call.qualifiedAt && (
                    <span className="cc-badge green">
                      <Check size={12} />
                      Passed by opener
                    </span>
                  )}
                </div>
                <h3 className="cc-notes-heading">What you need to know</h3>
                <p className="cc-handoff-notes">
                  {call.qualificationNotes || "No opener notes on this call."}
                </p>
                <div className="cc-next-step">
                  <span>
                    <CircleCheck size={19} />
                  </span>
                  <div>
                    <strong>Keep the conversation moving</strong>
                    <p>
                      Confirm the client&apos;s situation, agree on the next
                      step, and save the outcome.
                    </p>
                  </div>
                  <button
                    className="cc-text-button"
                    onClick={() => p.setOpen(true)}
                  >
                    Call notes <ArrowUpRight size={13} />
                  </button>
                </div>
                {call.salesStage === "TRANSFER_PENDING" && (
                  <div className="cc-role-note">
                    Consult with the opener. The client joins when the opener
                    completes the transfer.
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="cc-card cc-waiting">
              <span className="cc-waiting-icon">
                <ArrowRightLeft size={29} />
              </span>
              <h3>
                {open
                  ? "Waiting for your next qualified client"
                  : "Open when you are ready"}
              </h3>
              <p>
                {open
                  ? "An opener will connect with you when a client matches your debt tier. Their notes appear here before the handoff."
                  : "Switch to Open to receive transfers. Switch to Closed for a break; an active call will continue."}
              </p>
            </section>
          )}
          <Handoffs personal />
        </div>
        <div className="cc-side-column">
          <CloserBrief call={call} />
          <PersonalPipeline />
        </div>
      </div>
    </>
  );
}
function Handoffs({ personal = false }: { personal?: boolean }) {
  const data = usePhone().data!;
  const rows =
    data.sales?.handoffs.filter(
      (x) => !personal || x.closerId === data.userId,
    ) || [];
  return (
    <section id="handoffs" className="cc-card">
      <div className="cc-section-title">
        <div>
          <h2>
            {personal ? "Your recent handoffs" : "Recent qualified handoffs"}
          </h2>
          <p>Completed transfers and their latest outcomes</p>
        </div>
        <span className="cc-badge">{rows.length}</span>
      </div>
      {rows.length ? (
        <div className="cc-table-wrap">
          <table className="cc-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Debt</th>
                <th>Opener → Closer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.leadId ? (
                      <Link
                        className="cc-text-button"
                        href={`/leads/${x.leadId}`}
                      >
                        {x.clientName || "Client"}
                      </Link>
                    ) : (
                      x.clientName || "Client"
                    )}
                  </td>
                  <td>{money(x.debt)}</td>
                  <td>
                    {x.fronter?.name || "—"} → {x.closer?.name || "—"}
                  </td>
                  <td>
                    <span
                      className={`cc-badge ${x.status === "CLOSED" ? "green" : ""}`}
                    >
                      {x.status === "ASSIGNED"
                        ? "With closer"
                        : x.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cc-small-empty">
          Completed qualified transfers will appear here.
        </div>
      )}
    </section>
  );
}
function LiveFloor() {
  const now = useClock();
  const p = usePhone();
  const data = p.data!;
  const { saving, run } = useAction();
  const [role, setRole] = useState("ALL"),
    [state, setState] = useState("ALL"),
    [search, setSearch] = useState("");
  const roster = data.sales?.roster || [];
  const people = roster.filter(
    (x) =>
      (x.name.toLowerCase().includes(search.toLowerCase()) ||
        data.calls
          .find((c) => c.id === x.callId)
          ?.call?.lead?.contactName.toLowerCase()
          .includes(search.toLowerCase())) &&
      (role === "ALL" || x.role === role) &&
      (state === "ALL" ||
        (state === "AVAILABLE"
          ? ["OPEN", "READY"].includes(x.state)
          : x.state === state)),
  );
  const onCall = roster.filter((x) => x.state === "ON_CALL").length;
  const openers = roster.filter(
    (x) => x.role === "OPENER" && x.state === "READY",
  ).length;
  const closers = roster.filter(
    (x) => x.role === "CLOSER" && x.state === "OPEN",
  ).length;
  return (
    <>
      <div className="cc-role-heading">
        <div>
          <span className="cc-page-kicker">FLOOR MANAGEMENT</span>
          <h1>
            Live floor<span className="cc-title-pip">LIVE</span>
          </h1>
          <p>
            See who is speaking, who is ready, and which closers can receive a
            client.
          </p>
        </div>
        <span className="cc-connection online">
          <span className="cc-dot" />
          Updates automatically
        </span>
      </div>
      <HandoffRequests manager />
      <div className="cc-floor-metrics">
        {[
          { name: "On a call", value: onCall, icon: Phone, color: "blue" },
          {
            name: "Openers ready",
            value: openers,
            icon: Headphones,
            color: "green",
          },
          {
            name: "Closers open",
            value: closers,
            icon: ArrowRightLeft,
            color: "purple",
          },
          {
            name: "Web leads overdue",
            value: data.outbound?.webCounts?.overdue || 0,
            icon: Radio,
            color: "amber",
          },
        ].map((x) => (
          <div className="cc-metric" key={x.name}>
            <div>
              <span>{x.name}</span>
              <strong>{x.value}</strong>
            </div>
            <span className={`cc-metric-icon ${x.color}`}>
              <x.icon size={19} />
            </span>
          </div>
        ))}
      </div>
      <div className="cc-manager-grid">
        <div className="cc-main-column">
          <section className="cc-card cc-team-activity">
            <div className="cc-section-title">
              <div>
                <h2>
                  <Users size={18} />
                  Team activity
                  <span className="cc-count-pill">{roster.length}</span>
                </h2>
                <p>Live conversations and availability across your team</p>
              </div>
              <label className="cc-team-search">
                <Search size={15} />
                <input
                  aria-label="Search team activity"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agents or clients"
                />
              </label>
            </div>
            <div className="cc-floor-filters">
              <span>Show team</span>
              <select
                aria-label="Filter by agent role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="ALL">All roles</option>
                <option value="OPENER">Openers</option>
                <option value="CLOSER">Closers</option>
              </select>
              <select
                aria-label="Filter by agent status"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="ON_CALL">On a call</option>
                <option value="AVAILABLE">Available</option>
                <option value="WRAP_UP">Wrap up</option>
                <option value="CLOSED">Closed</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </div>
            <div className="cc-table-wrap">
              <table className="cc-table cc-floor-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Client</th>
                    <th>Debt</th>
                    <th>Call time</th>
                    {data.supervisor && <th>Monitor</th>}
                  </tr>
                </thead>
                <tbody>
                  {people.map((person: Person) => {
                    const call = data.calls.find((c) => c.id === person.callId);
                    const lead = call?.call?.lead;
                    return (
                      <tr
                        key={person.id}
                        className={
                          person.state === "ON_CALL" ? "cc-on-call-row" : ""
                        }
                      >
                        <td>
                          <div className="cc-person">
                            <span className="cc-agent-avatar">
                              {person.name
                                .split(" ")
                                .map((x) => x[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <strong>
                              {person.name}
                              {person.id === data.userId && <small>You</small>}
                            </strong>
                          </div>
                        </td>
                        <td>
                          {person.role === "CLOSER"
                            ? `Closer · Tier ${person.tier || "—"}`
                            : "Opener"}
                        </td>
                        <td>
                          <Status state={person.state} />
                        </td>
                        <td>
                          {call ? (
                            <div>
                              <strong>
                                {lead?.contactName || call.phoneNumber}
                              </strong>
                              {lead?.businessName && (
                                <small className="cc-floor-client-business">
                                  {lead.businessName}
                                </small>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {money(call?.qualifiedDebt ?? lead?.totalDebtEst)}
                        </td>
                        <td>
                          {call ? (
                            <Duration
                              call={call}
                              now={
                                now ||
                                Date.parse(call.answeredAt || call.createdAt)
                              }
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        {data.supervisor && (
                          <td>
                            {call &&
                            call.status === "IN_PROGRESS" &&
                            person.id !== data.userId ? (
                              <div className="cc-monitor-actions">
                                {[
                                  { mode: "LISTEN", label: "Listen" },
                                  { mode: "WHISPER", label: "Whisper" },
                                  { mode: "BARGE", label: "Join" },
                                ].map((m) => (
                                  <button
                                    disabled={
                                      saving ||
                                      p.busy ||
                                      !p.connected ||
                                      !!p.active ||
                                      p.automatic
                                    }
                                    key={m.mode}
                                    onClick={() =>
                                      void run(() => p.monitor(call.id, m.mode))
                                    }
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!people.length && (
              <div className="cc-small-empty">
                No agents match these filters.
              </div>
            )}
          </section>
          <Handoffs />
        </div>
        <div className="cc-side-column">
          <FloorCoverage />
          <PriorityWatch />
          <CampaignPulse />
        </div>
      </div>
    </>
  );
}

function ActivitySummary({ role }: { role: "OPENER" | "CLOSER" }) {
  const data = usePhone().data!;
  const calls = data.calls.filter(
    (c) => c.agentId === data.userId || c.openerId === data.userId,
  );
  const handoffs =
    data.sales?.handoffs.filter((h) =>
      role === "CLOSER"
        ? h.closerId === data.userId
        : h.fronterId === data.userId,
    ) || [];
  const metrics =
    role === "OPENER"
      ? [
          {
            label: "Recent conversations",
            value: calls.length,
            sub: "Your latest call records",
            icon: Phone,
            tone: "blue",
          },
          {
            label: "Qualified handoffs",
            value: handoffs.length,
            sub: "Clients passed to a closer",
            icon: ArrowRightLeft,
            tone: "violet",
          },
          {
            label: "Closers available",
            value:
              data.sales?.roster.filter(
                (x) => x.role === "CLOSER" && x.state === "OPEN",
              ).length || 0,
            sub: "Open across all debt tiers",
            icon: Users,
            tone: "green",
          },
        ]
      : [
          {
            label: "Recent handoffs",
            value: handoffs.length,
            sub: "Qualified clients received",
            icon: ArrowRightLeft,
            tone: "violet",
          },
          {
            label: "Closed handoffs",
            value: handoffs.filter((h) => h.status === "CLOSED").length,
            sub: "From your recent handoffs",
            icon: CircleCheck,
            tone: "green",
          },
          {
            label: "Recent handoff debt",
            value: money(handoffs.reduce((n, h) => n + (h.debt || 0), 0)),
            sub: "Confirmed debt on received clients",
            icon: BriefcaseBusiness,
            tone: "blue",
          },
        ];
  return (
    <div className="cc-activity-summary">
      {metrics.map((m) => (
        <div key={m.label}>
          <span className={`cc-summary-icon ${m.tone}`}>
            <m.icon size={19} />
          </span>
          <div>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <small>{m.sub}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
function PriorityWatch() {
  const out = usePhone().data?.outbound;
  const now = useClock();
  const jobs = (out?.webLeads || [])
    .filter((j) => !j.attemptedAt && ["WAITING", "CLAIMED"].includes(j.status))
    .sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt));
  return (
    <section id="priority" className="cc-card cc-priority-watch">
      <div className="cc-section-title">
        <div>
          <h2>
            <span className="cc-priority-bolt">
              <Zap size={15} />
            </span>
            Web lead priority
          </h2>
          <p>First call goal · Under 1 minute</p>
        </div>
        <span className="cc-count-pill">
          {out?.webCounts?.waiting ?? jobs.length}
        </span>
      </div>
      {jobs.slice(0, 4).map((j) => {
        const remaining = now
          ? Math.ceil((Date.parse(j.deadlineAt) - now) / 1000)
          : j.sla.seconds;
        return (
          <div className="cc-watch-row" key={j.leadId}>
            <span className="cc-watch-avatar">
              {initials(j.lead.contactName)}
            </span>
            <div>
              <Link href={`/leads/${j.leadId}`}>{j.lead.contactName}</Link>
              <small>{j.lead.businessName}</small>
            </div>
            <span className={`cc-deadline ${remaining <= 0 ? "late" : ""}`}>
              <Clock3 size={11} />
              {remaining <= 0 ? "Overdue" : `${remaining}s`}
            </span>
          </div>
        );
      })}
      {!jobs.length && (
        <div className="cc-priority-clear">
          <CircleCheck size={18} />
          <div>
            <strong>Queue is clear</strong>
            <small>New web leads will appear here.</small>
          </div>
        </div>
      )}
      <footer>
        <span className="cc-dot green" />
        Shared priority team<span>Auto routing</span>
      </footer>
    </section>
  );
}
function CloserBrief({ call }: { call: VoiceCall | null }) {
  const data = usePhone().data!;
  const opener = data.sales?.roster.find((x) => x.id === call?.openerId);
  return (
    <section className="cc-card cc-handoff-timeline">
      <div className="cc-section-title">
        <h2>
          <Route size={17} />
          Handoff details
        </h2>
      </div>
      {call ? (
        <>
          <div className="cc-timeline-event">
            <span className="complete">
              <Phone size={13} />
            </span>
            <div>
              <strong>Conversation started</strong>
              <small>
                {call.createdAt
                  ? new Date(call.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </small>
            </div>
          </div>
          <div className="cc-timeline-event">
            <span className={call.qualifiedAt ? "complete" : ""}>
              <Check size={14} />
            </span>
            <div>
              <strong>
                {call.qualifiedAt
                  ? "Qualified by opener"
                  : "Qualification pending"}
              </strong>
              <small>{opener?.name || "No opener recorded"}</small>
            </div>
          </div>
          <div className="cc-timeline-event last">
            <span className="current">
              <Headphones size={14} />
            </span>
            <div>
              <strong>
                {isTerminal(call.status)
                  ? "Call completed"
                  : call.salesStage === "TRANSFER_PENDING"
                    ? "Consulting with opener"
                    : "With you now"}
              </strong>
              <small>
                {isTerminal(call.status)
                  ? "Save the outcome to finish wrap up"
                  : call.salesStage === "TRANSFER_PENDING"
                    ? "Client waiting for introduction"
                    : "Client conversation"}
              </small>
            </div>
          </div>
          {call.leadId && (
            <Link className="cc-record-link" href={`/leads/${call.leadId}`}>
              <ContactRound size={16} />
              Open full client record
              <ArrowUpRight size={15} />
            </Link>
          )}
        </>
      ) : (
        <div className="cc-small-empty">
          The next client&apos;s qualification and handoff details will appear
          here.
        </div>
      )}
    </section>
  );
}
function PersonalPipeline() {
  const data = usePhone().data!;
  const rows =
    data.sales?.handoffs
      .filter((h) => h.closerId === data.userId)
      .slice(0, 5) || [];
  return (
    <section className="cc-card cc-personal-pipeline">
      <div className="cc-section-title">
        <div>
          <h2>
            <BriefcaseBusiness size={17} />
            Your recent clients
          </h2>
          <p>Follow each qualified handoff</p>
        </div>
      </div>
      {rows.map((h) => (
        <div className="cc-pipeline-row" key={h.id}>
          <span className="cc-pipeline-avatar">
            {initials(h.clientName || "Client")}
          </span>
          <div>
            {h.leadId ? (
              <Link href={`/leads/${h.leadId}`}>
                {h.clientName || "Client"}
              </Link>
            ) : (
              <strong>{h.clientName || "Client"}</strong>
            )}
            <small>{money(h.debt)}</small>
          </div>
          <span
            className={`cc-badge ${h.status === "CLOSED" ? "green" : "blue"}`}
          >
            {h.status === "ASSIGNED" ? "Assigned" : h.status.toLowerCase()}
          </span>
        </div>
      ))}
      {!rows.length && (
        <div className="cc-small-empty">Your handoffs will appear here.</div>
      )}
    </section>
  );
}
function FloorCoverage() {
  const sales = usePhone().data?.sales;
  return (
    <section className="cc-card cc-floor-coverage">
      <div className="cc-section-title">
        <div>
          <h2>
            <Users size={17} />
            Closer coverage
          </h2>
          <p>Availability by debt tier</p>
        </div>
      </div>
      {[1, 2, 3].map((tier) => {
        const people =
          sales?.roster.filter((x) => x.role === "CLOSER" && x.tier === tier) ||
          [];
        const open = people.filter((x) => x.state === "OPEN").length,
          busy = people.filter((x) => x.state === "ON_CALL").length;
        return (
          <div className="cc-coverage-tier" key={tier}>
            <div>
              <strong>Tier {tier}</strong>
              <span>
                <b>{open}</b> / {people.length} open
              </span>
            </div>
            <small>
              {sales
                ? closerDebtRange(
                    tier,
                    sales.config.tier1Max,
                    sales.config.tier2Max,
                  )
                : "No routing set"}
            </small>
            <div
              className="cc-coverage-track"
              aria-label={`Tier ${tier}: ${open} open, ${busy} on calls, ${people.length - open - busy} unavailable`}
            >
              {people.map((x) => (
                <span
                  title={`${x.name}: ${labels[x.state] || x.state}`}
                  className={
                    x.state === "OPEN"
                      ? "open"
                      : x.state === "ON_CALL"
                        ? "busy"
                        : ""
                  }
                  key={x.id}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="cc-coverage-legend">
        <span>
          <i />
          Open
        </span>
        <span>
          <i />
          On a call
        </span>
        <span>
          <i />
          Unavailable
        </span>
      </div>
      <Link className="cc-roster-link" href="/floor-manager/closers">
        Manage debt tiers
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
function CampaignPulse() {
  const campaigns = usePhone().data?.outbound?.coldCampaigns || [];
  return (
    <section className="cc-campaign-pulse">
      <div className="cc-pulse-heading">
        <Radio size={18} />
        <strong>Outbound campaigns</strong>
        <span className="cc-dot green" />
      </div>
      {campaigns.map((c) => (
        <div className="cc-pulse-campaign" key={c.campaignId}>
          <div>
            <strong>{c.campaign.name}</strong>
            <span>{c.status === "RUNNING" ? "Running" : "Paused"}</span>
          </div>
          <p>
            <b>{c.inFlight}</b>
            <span> / {c.maxLines} lines</span>
          </p>
          <div className="cc-line-track">
            <span
              style={{
                width: `${Math.min(100, (c.inFlight / Math.max(1, c.maxLines)) * 100)}%`,
              }}
            />
          </div>
          <small>Shared across the team</small>
        </div>
      ))}
      {!campaigns.length && (
        <p className="cc-role-note">No parallel campaigns configured.</p>
      )}
      <Link href={CALL_CENTER_PATHS.operations}>
        Manage campaigns
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
