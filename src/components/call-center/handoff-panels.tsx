"use client";
import { useState } from "react";
import { usePhone } from "./provider";
import type { VoiceCall } from "./types";
import { tierForDebt } from "@/lib/closer-tier-config";
import "./handoff.css";
const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
export function HandoffBrief({ call }: { call: VoiceCall }) {
  const lead = call.call?.lead;
  return (
    <div className="cc-handoff-brief">
      <div className="cc-handoff-origin">
        <span>
          Source <strong>{lead?.source || "Not provided"}</strong>
        </span>
        <span>
          Brand <strong>{lead?.brand || "Not provided"}</strong>
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Lender</th>
            <th>Debt</th>
          </tr>
        </thead>
        <tbody>
          {call.qualifiedDebts?.map((row) => (
            <tr key={row.key}>
              <td>{row.creditorName}</td>
              <td>{money(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Total debt</th>
            <th>{money(call.qualifiedDebt || 0)}</th>
          </tr>
        </tfoot>
      </table>
      <p>{call.qualificationNotes}</p>
    </div>
  );
}
function HandoffRequest({
  call,
  manager,
}: {
  call: VoiceCall;
  manager: boolean;
}) {
  const p = usePhone();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const sales = p.data!.sales!;
  const tier = tierForDebt(call.qualifiedDebt || 0, sales.config);
  const opener = sales.roster.find((person) => person.id === call.openerId);
  const choices = sales.roster.filter(
    (person) => person.role === "CLOSER" && person.tier === tier,
  );
  async function act(body: Record<string, unknown>) {
    setSaving(true);
    p.setError("");
    try {
      await p.command({
        id: call.id,
        requestKey: call.transferRequestKey,
        ...body,
      });
      await p.refresh();
    } catch (error) {
      p.setError(
        error instanceof Error ? error.message : "Handoff action failed",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="cc-handoff-request">
      <header>
        <div>
          <h3>{call.call?.lead?.contactName || call.phoneNumber}</h3>
          <p>
            {call.call?.lead?.businessName} · Opener:{" "}
            {opener?.name || "Assigned opener"}
          </p>
        </div>
        <span>Tier {tier}</span>
      </header>
      <HandoffBrief call={call} />
      {manager ? (
        <div className="cc-handoff-review">
          <label>
            Receiving closer
            <select
              aria-label={`Receiving closer for ${call.call?.lead?.contactName || call.id}`}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              disabled={saving}
            >
              <option value="">Select a Tier {tier} closer</option>
              {choices.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} ·{" "}
                  {person.state.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Manager note
            <input
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional feedback for the opener"
            />
          </label>
          <div className="cc-sales-actions">
            <button
              className="cc-button"
              disabled={saving}
              onClick={() =>
                void act({ action: "review-transfer", approve: false, reason })
              }
            >
              Decline request
            </button>
            <button
              className="cc-button primary"
              disabled={saving || !target}
              onClick={() =>
                void act({
                  action: "review-transfer",
                  approve: true,
                  target,
                  reason,
                })
              }
            >
              Approve & ping closer
            </button>
          </div>
        </div>
      ) : (
        <div className="cc-handoff-review">
          <p>
            {call.salesStage === "PENDING_CLOSER"
              ? "Floor Manager approved this handoff. Mark open when you are ready to join the client and opener."
              : call.salesStage === "CLOSER_READY"
                ? "You are reserved for this client. Waiting for the opener to connect you."
                : "Joining the client and opener for the introduction."}
          </p>
          {call.salesStage === "PENDING_CLOSER" && (
            <button
              className="cc-button primary"
              disabled={saving || !p.connected || !!p.data?.me?.activeCallId}
              onClick={() => void act({ action: "closer-ready" })}
            >
              Mark open & notify opener
            </button>
          )}
        </div>
      )}
    </article>
  );
}
export function HandoffRequests({ manager = false }: { manager?: boolean }) {
  const p = usePhone();
  const calls =
    p.data?.calls.filter(
      (call) =>
        call.status === "IN_PROGRESS" &&
        (manager
          ? call.salesStage === "PENDING_APPROVAL"
          : call.transferTargetId === p.data?.userId &&
            ["PENDING_CLOSER", "CLOSER_READY", "TRANSFER_PENDING"].includes(
              call.salesStage || "",
            )),
    ) || [];
  if (!calls.length) return null;
  return (
    <section
      id={manager ? "transfer-approvals" : "handoff-requests"}
      className="cc-handoff-requests"
    >
      <header>
        <h2>{manager ? "Transfer approvals" : "Approved handoffs"}</h2>
        <span>{calls.length} waiting</span>
      </header>
      {calls.map((call) => (
        <HandoffRequest
          key={`${call.id}-${call.transferRequestKey}`}
          call={call}
          manager={manager}
        />
      ))}
    </section>
  );
}
